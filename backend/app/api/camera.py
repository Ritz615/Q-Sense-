"""
Computer Vision Queue Monitoring API routes.
Acquires frames, performs person detection, applies ROI filtering, and logs observations.
"""
import sys
import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.queue import CameraSource, QueueObservation, QueueEvent
from app.schemas.schemas import (
    CameraSourceCreate,
    CameraSourceUpdate,
    CameraSourceOut,
    CameraFrameResponse,
)

# Ensure root workspace is in sys.path to import ml package
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from ml.computer_vision.stream import CameraStreamProcessor

router = APIRouter(prefix="/camera", tags=["Computer Vision Queue Monitoring"])

# In-memory processor pool for active camera streams
_processors: dict[int, CameraStreamProcessor] = {}


def _get_or_create_processor(camera: CameraSource) -> CameraStreamProcessor:
    if camera.id not in _processors:
        roi = tuple(camera.roi_normalized) if camera.roi_normalized and len(camera.roi_normalized) == 4 else (0.1, 0.35, 0.9, 0.95)
        src = camera.stream_source
        if src.isdigit():
            src = int(src)
        _processors[camera.id] = CameraStreamProcessor(source=src, roi_normalized=roi)
    return _processors[camera.id]


@router.get("/status")
async def cv_status(current_user: User = Depends(get_current_user)):
    """Check computer vision engine availability and OpenCV version."""
    import cv2
    return {
        "engine": "OpenCV Computer Vision",
        "version": cv2.__version__,
        "mode": "HOG Pedestrian Detector + Temporal Smoothing Filter",
        "gpu_accelerated": False,
        "active_stream_processors": len(_processors),
        "privacy": "Privacy compliant: citizen identities and biometric facial data are never stored or extracted.",
    }


@router.get("/sources", response_model=List[CameraSourceOut])
async def list_camera_sources(
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(CameraSource).order_by(CameraSource.id)
    if department_id:
        q = q.where(CameraSource.department_id == department_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/sources", response_model=CameraSourceOut, status_code=status.HTTP_201_CREATED)
async def create_camera_source(
    payload: CameraSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    cam = CameraSource(**payload.model_dump())
    db.add(cam)
    await db.flush()
    await db.refresh(cam)
    return cam


@router.get("/sources/{camera_id}", response_model=CameraSourceOut)
async def get_camera_source(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(CameraSource).where(CameraSource.id == camera_id))
    cam = res.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera source not found")
    return cam


@router.patch("/sources/{camera_id}", response_model=CameraSourceOut)
async def update_camera_source(
    camera_id: int,
    payload: CameraSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    res = await db.execute(select(CameraSource).where(CameraSource.id == camera_id))
    cam = res.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera source not found")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(cam, k, v)

    # If ROI changed, update existing processor
    if payload.roi_normalized and camera_id in _processors and len(payload.roi_normalized) == 4:
        r = payload.roi_normalized
        _processors[camera_id].set_roi(r[0], r[1], r[2], r[3])

    await db.flush()
    await db.refresh(cam)
    return cam


@router.get("/sources/{camera_id}/snapshot")
async def get_camera_snapshot(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a live JPEG snapshot from the camera with ROI and person detection boxes."""
    res = await db.execute(select(CameraSource).where(CameraSource.id == camera_id))
    cam = res.scalar_one_or_none()
    if not cam:
        # Fallback to demo synthetic frame if no camera in DB
        processor = CameraStreamProcessor(source="synthetic")
        frame_data = processor.process_frame()
        return Response(content=frame_data["annotated_frame_bytes"], media_type="image/jpeg")

    processor = _get_or_create_processor(cam)
    frame_data = processor.process_frame()

    return Response(content=frame_data["annotated_frame_bytes"], media_type="image/jpeg")


@router.post("/sources/{camera_id}/step", response_model=CameraFrameResponse)
async def step_camera_frame(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Acquire frame, count persons in ROI, log observation to database, and return metrics.
    """
    res = await db.execute(select(CameraSource).where(CameraSource.id == camera_id))
    cam = res.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera source not found")

    processor = _get_or_create_processor(cam)
    frame_data = processor.process_frame()

    now = datetime.now(timezone.utc)
    raw_occ = frame_data["raw_occupancy"]
    smoothed_occ = frame_data["smoothed_occupancy"]

    cam.last_occupancy = raw_occ
    cam.last_seen_at = now
    cam.status = frame_data["status"]

    # Log queue observation from camera source
    obs = QueueObservation(
        department_id=cam.department_id,
        timestamp=now,
        people_waiting=int(round(smoothed_occ)),
        active_counters=2,
        arrivals_in_interval=max(1, int(round(smoothed_occ * 0.3))),
        completed_services=1,
        avg_service_time_seconds=300.0,
        observed_waiting_time_seconds=float(round(smoothed_occ * 150.0)),
        source="camera",
        interval_minutes=1,
    )
    db.add(obs)

    # Log queue event
    evt = QueueEvent(
        department_id=cam.department_id,
        event_type="camera_occupancy_update",
        timestamp=now,
        payload={
            "camera_id": cam.id,
            "raw_occupancy": raw_occ,
            "smoothed_occupancy": smoothed_occ,
            "fps": frame_data["fps"],
        },
        source="camera",
    )
    db.add(evt)

    await db.flush()

    return CameraFrameResponse(
        camera_id=cam.id,
        department_id=cam.department_id,
        raw_occupancy=raw_occ,
        smoothed_occupancy=smoothed_occ,
        fps=frame_data["fps"],
        status=frame_data["status"],
        roi=list(frame_data["roi"]),
        detections_count=len(frame_data["detections"]),
        timestamp=now,
    )
