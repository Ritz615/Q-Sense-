"""
Automated unit tests: Computer Vision Person Detection, ROI Filtering, and Camera API.
"""
import pytest
from httpx import AsyncClient
from ml.computer_vision.detector import SyntheticFrameGenerator, PersonDetector
from ml.computer_vision.tracker import TemporalSmoother
from ml.computer_vision.stream import CameraStreamProcessor


def test_synthetic_frame_generator():
    gen = SyntheticFrameGenerator(width=640, height=480)
    frame, detections = gen.generate_frame(person_count=6)
    assert frame.shape == (480, 640, 3)
    assert len(detections) == 6
    for det in detections:
        assert "box" in det
        assert "center" in det
        assert "confidence" in det


def test_temporal_smoother():
    smoother = TemporalSmoother(window_size=5, alpha=0.5)
    smoother.update(10)
    v2 = smoother.update(12)
    v3 = smoother.update(11)
    # Smoothed value should be between 10 and 12
    assert 10.0 <= v3 <= 12.0


def test_camera_stream_processor():
    processor = CameraStreamProcessor(source="synthetic", roi_normalized=(0.1, 0.2, 0.9, 0.9))
    result = processor.process_frame(target_person_count=5)
    assert "raw_occupancy" in result
    assert "smoothed_occupancy" in result
    assert "annotated_frame_bytes" in result
    assert len(result["annotated_frame_bytes"]) > 1000
    assert result["annotated_frame_bytes"][:2] == b"\xff\xd8"  # JPEG header


@pytest.mark.asyncio
async def test_camera_api_endpoints(client: AsyncClient, admin_headers, seeded_dept):
    # Status
    status_resp = await client.get("/api/v1/camera/status", headers=admin_headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["engine"] == "OpenCV Computer Vision"

    # Create camera source
    cam_payload = {
        "department_id": seeded_dept.id,
        "name": "Entrance Camera Test",
        "stream_source": "synthetic",
        "roi_normalized": [0.1, 0.2, 0.8, 0.9],
    }
    create_resp = await client.post("/api/v1/camera/sources", json=cam_payload, headers=admin_headers)
    assert create_resp.status_code == 201
    cam_id = create_resp.json()["id"]

    # Step frame
    step_resp = await client.post(f"/api/v1/camera/sources/{cam_id}/step", headers=admin_headers)
    assert step_resp.status_code == 200
    frame_metrics = step_resp.json()
    assert "raw_occupancy" in frame_metrics
    assert "smoothed_occupancy" in frame_metrics

    # Snapshot
    snap_resp = await client.get(f"/api/v1/camera/sources/{cam_id}/snapshot", headers=admin_headers)
    assert snap_resp.status_code == 200
    assert snap_resp.headers["content-type"] == "image/jpeg"
    assert snap_resp.content.startswith(b"\xff\xd8")
