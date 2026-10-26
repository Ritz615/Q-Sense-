"""
Dashboard, Queue observations, and real-time monitoring API routes.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database.session import get_db
from app.models.operational import Department, Counter, Staff
from app.models.queue import QueueObservation, QueueEvent, QueueTicket
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.schemas import DashboardMetrics, QueueObservationOut

router = APIRouter(tags=["Dashboard & Queue"])


@router.get("/dashboard", response_model=DashboardMetrics)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    # Total queue: latest observation per department
    latest_obs = await db.execute(
        select(func.sum(QueueObservation.people_waiting)).where(
            QueueObservation.timestamp >= now - timedelta(minutes=20)
        )
    )
    total_queue = int(latest_obs.scalar() or 0)

    # Counters
    active_res = await db.execute(select(func.count()).where(Counter.status == "open", Counter.is_active == True))
    active_counters = int(active_res.scalar() or 0)

    available_res = await db.execute(select(func.count()).where(Counter.is_active == True))
    available_counters = int(available_res.scalar() or 0)

    # Staff
    staff_res = await db.execute(select(func.count()).where(Staff.is_available == True, Staff.is_active == True))
    available_staff = int(staff_res.scalar() or 0)

    # Arrivals and completions in last hour
    one_hour_ago = now - timedelta(hours=1)
    arr_res = await db.execute(
        select(func.sum(QueueObservation.arrivals_in_interval)).where(
            QueueObservation.timestamp >= one_hour_ago
        )
    )
    arrival_rate = float(arr_res.scalar() or 0)

    comp_res = await db.execute(
        select(func.sum(QueueObservation.completed_services)).where(
            QueueObservation.timestamp >= one_hour_ago
        )
    )
    service_rate = float(comp_res.scalar() or 0)

    # Avg waiting time from recent observations
    wait_res = await db.execute(
        select(func.avg(QueueObservation.observed_waiting_time_seconds)).where(
            QueueObservation.timestamp >= now - timedelta(minutes=30),
            QueueObservation.observed_waiting_time_seconds.isnot(None),
        )
    )
    avg_wait_sec = float(wait_res.scalar() or 0)

    # Counter utilization
    utilization = (active_counters / max(available_counters, 1)) * 100.0

    # Forecast demand (next hour) — simple extrapolation from arrival rate
    forecast_next_hour = int(arrival_rate * 1.05)

    # Congestion alerts
    alerts = []
    if total_queue > 30:
        alerts.append(f"High queue volume: {total_queue} people waiting")
    if active_counters < 2 and total_queue > 10:
        alerts.append("Low counter availability relative to demand")
    if avg_wait_sec > 900:
        alerts.append(f"Extended waiting times: ~{avg_wait_sec/60:.0f} min average")

    return DashboardMetrics(
        total_queue=total_queue,
        active_counters=active_counters,
        available_counters=available_counters,
        avg_waiting_time_minutes=avg_wait_sec / 60,
        arrival_rate_per_hour=arrival_rate,
        service_rate_per_hour=service_rate,
        forecast_next_hour=forecast_next_hour,
        counter_utilization=utilization,
        available_staff=available_staff,
        congestion_alerts=alerts,
        last_updated=now,
    )


@router.get("/queue/observations", response_model=List[QueueObservationOut])
async def list_observations(
    department_id: Optional[int] = Query(None),
    hours: int = Query(4, ge=1, le=168),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = select(QueueObservation).where(QueueObservation.timestamp >= since)
    if department_id:
        q = q.where(QueueObservation.department_id == department_id)
    q = q.order_by(desc(QueueObservation.timestamp)).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/queue/events")
async def list_events(
    department_id: Optional[int] = Query(None),
    hours: int = Query(1),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = select(QueueEvent).where(QueueEvent.timestamp >= since)
    if department_id:
        q = q.where(QueueEvent.department_id == department_id)
    q = q.order_by(desc(QueueEvent.timestamp)).limit(limit)
    result = await db.execute(q)
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "department_id": e.department_id,
            "timestamp": e.timestamp.isoformat(),
            "payload": e.payload,
            "source": e.source,
        }
        for e in events
    ]
