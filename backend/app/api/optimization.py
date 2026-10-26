"""
Optimization API routes — counter/staff allocation recommendations.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.analytics import AllocationRecommendation, AuditLog
from app.schemas.schemas import OptimizationRequest, OptimizationResponse, RecommendationReview, AllocationRecommendationOut

router = APIRouter(prefix="/optimization", tags=["Optimization"])


@router.post("/recommend", response_model=OptimizationResponse)
async def generate_recommendation(
    payload: OptimizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.services.optimization_service import OptimizationService
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_SYNC_URL)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        svc = OptimizationService(session)
        result = svc.optimize(
            dept_id=payload.department_id,
            horizon_minutes=payload.horizon_minutes,
            weight_wait=payload.weight_wait,
            weight_cost=payload.weight_cost,
            weight_utilization=payload.weight_utilization,
        )

    # Persist recommendation
    rec = AllocationRecommendation(
        department_id=payload.department_id,
        generated_at=datetime.now(timezone.utc),
        recommended_counters=result["recommended_counters"],
        current_counters=result["current_counters"],
        forecast_demand=result.get("forecast_demand"),
        expected_wait_before=result.get("expected_wait_before"),
        expected_wait_after=result.get("expected_wait_after"),
        utilization_before=result.get("utilization_before"),
        utilization_after=result.get("utilization_after"),
        assignment_plan=result.get("assignment_plan"),
        objective_value=result.get("objective_value"),
        solver_status=result.get("solver_status"),
        explanation=result.get("explanation"),
    )
    db.add(rec)
    await db.flush()
    await db.refresh(rec)

    return OptimizationResponse(
        recommendation_id=rec.id,
        department_id=payload.department_id,
        current_counters=result["current_counters"],
        recommended_counters=result["recommended_counters"],
        forecast_demand=result.get("forecast_demand", 0.0),
        expected_wait_before_minutes=result.get("expected_wait_before", 0.0) / 60,
        expected_wait_after_minutes=result.get("expected_wait_after", 0.0) / 60,
        utilization_before=result.get("utilization_before", 0.0),
        utilization_after=result.get("utilization_after", 0.0),
        solver_status=result.get("solver_status", "optimal"),
        objective_value=result.get("objective_value", 0.0),
        explanation=result.get("explanation", ""),
        assignment_plan=result.get("assignment_plan"),
    )


@router.get("/recommendations", response_model=List[AllocationRecommendationOut])
async def list_recommendations(
    department_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AllocationRecommendation).order_by(desc(AllocationRecommendation.generated_at))
    if department_id:
        q = q.where(AllocationRecommendation.department_id == department_id)
    if status:
        q = q.where(AllocationRecommendation.status == status)
    result = await db.execute(q.limit(limit))
    return result.scalars().all()


@router.patch("/recommendations/{rec_id}/review", response_model=AllocationRecommendationOut)
async def review_recommendation(
    rec_id: int,
    payload: RecommendationReview,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(AllocationRecommendation).where(AllocationRecommendation.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    rec.status = payload.status
    rec.reviewed_by = current_user.id
    rec.reviewed_at = datetime.now(timezone.utc)
    rec.review_notes = payload.notes

    log = AuditLog(
        user_id=current_user.id,
        action=f"recommendation_{payload.status}",
        resource_type="allocation_recommendation",
        resource_id=rec_id,
        details={"notes": payload.notes},
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    await db.flush()
    await db.refresh(rec)
    return rec
