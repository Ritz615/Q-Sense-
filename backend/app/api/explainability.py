"""
Explainability API routes — feature importance, prediction explanations.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.analytics import ModelVersion, AllocationRecommendation

router = APIRouter(prefix="/explain", tags=["Explainability"])


@router.get("/feature-importance/{model_id}")
async def feature_importance(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return feature importance for tree-based models (RF/GB)."""
    result = await db.execute(select(ModelVersion).where(ModelVersion.id == model_id))
    mv = result.scalar_one_or_none()

    if not mv:
        return {"error": "Model not found"}

    if mv.status != "ready":
        return {"message": f"Model status is '{mv.status}' — not yet ready for explanation"}

    # Load model and return feature importances
    try:
        from app.services.forecasting_service import ForecastingService
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.core.config import settings

        engine = create_engine(settings.DATABASE_SYNC_URL)
        Session = sessionmaker(bind=engine)
        with Session() as session:
            svc = ForecastingService(session)
            importance = svc.get_feature_importance(model_id)
        return {
            "model_id": model_id,
            "model_type": mv.model_type,
            "department_id": mv.department_id,
            "feature_importance": importance,
            "note": "Importance scores from trained model weights. Higher = more influential.",
        }
    except Exception as e:
        return {"model_id": model_id, "error": str(e), "feature_importance": []}


@router.get("/recommendation/{rec_id}")
async def explain_recommendation(
    rec_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a structured explanation for an allocation recommendation."""
    result = await db.execute(select(AllocationRecommendation).where(AllocationRecommendation.id == rec_id))
    rec = result.scalar_one_or_none()

    if not rec:
        return {"error": "Recommendation not found"}

    change = rec.recommended_counters - rec.current_counters
    wait_change = (
        ((rec.expected_wait_before or 0) - (rec.expected_wait_after or 0)) / 60
        if rec.expected_wait_before and rec.expected_wait_after else None
    )

    factors = []
    if rec.forecast_demand and rec.forecast_demand > 20:
        factors.append(f"High forecast demand: {rec.forecast_demand:.0f} arrivals expected")
    if rec.utilization_before and rec.utilization_before > 80:
        factors.append(f"High counter utilization before: {rec.utilization_before:.1f}%")
    if change > 0:
        factors.append(f"Opening {change} additional counter(s) to reduce congestion")
    elif change < 0:
        factors.append(f"Closing {abs(change)} under-utilized counter(s) to reduce cost")
    else:
        factors.append("Current allocation is near-optimal given constraints")

    return {
        "recommendation_id": rec_id,
        "department_id": rec.department_id,
        "summary": rec.explanation or "No explanation generated",
        "change": change,
        "estimated_wait_reduction_minutes": wait_change,
        "key_factors": factors,
        "solver_status": rec.solver_status,
        "objective_value": rec.objective_value,
        "note": (
            "Explanation is based on optimization output using forecast-derived demand estimates. "
            "Actual outcomes depend on real arrival patterns and staff behavior."
        ),
    }


@router.get("/prediction-context/{department_id}")
async def prediction_context(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Natural-language context for why a queue is growing or shrinking."""
    from datetime import timedelta
    from app.models.queue import QueueObservation
    from sqlalchemy import func

    now = datetime.now(timezone.utc)
    recent = await db.execute(
        select(QueueObservation)
        .where(
            QueueObservation.department_id == department_id,
            QueueObservation.timestamp >= now - timedelta(hours=1),
        )
        .order_by(desc(QueueObservation.timestamp))
        .limit(8)
    )
    obs = list(recent.scalars().all())

    if not obs:
        return {"message": "No recent observations available for this department."}

    latest = obs[0]
    oldest = obs[-1]
    trend = latest.people_waiting - oldest.people_waiting
    trend_dir = "growing" if trend > 0 else ("shrinking" if trend < 0 else "stable")

    narrative = (
        f"Over the last {len(obs) * 15} minutes, the queue for department {department_id} "
        f"has been {trend_dir} (from {oldest.people_waiting} to {latest.people_waiting} people). "
        f"Current active counters: {latest.active_counters}. "
        f"Recent arrival rate: ~{latest.arrivals_in_interval} per 15-min interval. "
    )
    if latest.observed_waiting_time_seconds:
        narrative += f"Estimated waiting time: {latest.observed_waiting_time_seconds/60:.1f} min."

    return {
        "department_id": department_id,
        "narrative": narrative,
        "trend": trend_dir,
        "queue_delta": trend,
        "current_queue": latest.people_waiting,
        "current_counters": latest.active_counters,
        "note": "This explanation is derived from observed/simulated queue data, not causal analysis.",
    }
