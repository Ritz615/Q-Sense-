"""
Forecasting API routes — model training, evaluation, and inference.
"""
import os
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.analytics import ModelVersion, ForecastResult
from app.models.queue import QueueObservation
from app.schemas.schemas import ForecastRequest, ForecastResponse, ForecastPoint, TrainRequest, TrainResponse

router = APIRouter(prefix="/forecasting", tags=["Forecasting"])


async def _run_training(model_version_id: int, dept_id: int, model_type: str, db_url: str):
    """Background task: train the selected model on historical observations."""
    import sys, asyncio
    # Use a fresh sync session for background task
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    from app.services.forecasting_service import ForecastingService

    sync_url = settings.DATABASE_SYNC_URL
    engine = create_engine(sync_url)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        try:
            svc = ForecastingService(session)
            metrics = svc.train(dept_id, model_type, model_version_id)
            mv = session.get(ModelVersion, model_version_id)
            if mv:
                mv.status = "ready"
                mv.metrics = metrics
                mv.trained_at = datetime.now(timezone.utc)
                session.commit()
        except Exception as e:
            mv = session.get(ModelVersion, model_version_id)
            if mv:
                mv.status = "failed"
                mv.metrics = {"error": str(e)}
                session.commit()


@router.post("/train", response_model=TrainResponse)
async def train_model(
    payload: TrainRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.core.config import settings

    version_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    model_dir = os.path.join(settings.MODEL_DIR, f"dept_{payload.department_id}", payload.model_type)
    os.makedirs(model_dir, exist_ok=True)

    mv = ModelVersion(
        name=f"{payload.model_type.upper()} - Dept {payload.department_id}",
        model_type=payload.model_type,
        department_id=payload.department_id,
        version=version_str,
        file_path=os.path.join(model_dir, f"model_{version_str}.pkl"),
        status="training",
    )
    db.add(mv)
    await db.flush()
    await db.refresh(mv)

    from app.core.config import settings as s
    background_tasks.add_task(_run_training, mv.id, payload.department_id, payload.model_type, s.DATABASE_SYNC_URL)

    return TrainResponse(
        model_version_id=mv.id,
        model_type=payload.model_type,
        department_id=payload.department_id,
        status="training",
        message="Training started in background. Poll /forecasting/models for status.",
    )


@router.get("/models")
async def list_models(
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(ModelVersion).order_by(desc(ModelVersion.created_at))
    if department_id:
        q = q.where(ModelVersion.department_id == department_id)
    result = await db.execute(q)
    models = result.scalars().all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "model_type": m.model_type,
            "department_id": m.department_id,
            "version": m.version,
            "status": m.status,
            "metrics": m.metrics,
            "trained_at": m.trained_at.isoformat() if m.trained_at else None,
        }
        for m in models
    ]


@router.post("/predict", response_model=ForecastResponse)
async def predict(
    payload: ForecastRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.forecasting_service import ForecastingService
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings

    # Run inference synchronously (no GPU needed for RF/baseline)
    engine = create_engine(settings.DATABASE_SYNC_URL)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        svc = ForecastingService(session)
        predictions = svc.predict(
            dept_id=payload.department_id,
            model_type=payload.model_type,
            horizon_minutes=payload.horizon_minutes,
        )

    # Store result
    fr = ForecastResult(
        department_id=payload.department_id,
        generated_at=datetime.now(timezone.utc),
        forecast_horizon_minutes=payload.horizon_minutes,
        model_type=payload.model_type,
        predictions=[p.model_dump(mode="json") for p in predictions],
    )
    db.add(fr)

    return ForecastResponse(
        department_id=payload.department_id,
        model_type=payload.model_type,
        generated_at=datetime.now(timezone.utc),
        horizon_minutes=payload.horizon_minutes,
        predictions=predictions,
    )


@router.get("/history/{department_id}")
async def forecast_history(
    department_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ForecastResult)
        .where(ForecastResult.department_id == department_id)
        .order_by(desc(ForecastResult.generated_at))
        .limit(limit)
    )
    frs = result.scalars().all()
    return [
        {
            "id": fr.id,
            "model_type": fr.model_type,
            "generated_at": fr.generated_at.isoformat(),
            "horizon_minutes": fr.forecast_horizon_minutes,
            "prediction_count": len(fr.predictions or []),
        }
        for fr in frs
    ]
