"""
Analytics, reporting, and audit log API routes.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.analytics import AuditLog
from app.models.queue import QueueObservation
from app.schemas.schemas import AuditLogOut

router = APIRouter(tags=["Analytics & Reports"])


analytics_router = APIRouter(prefix="/analytics")
reports_router = APIRouter(prefix="/reports")
audit_router = APIRouter(prefix="/audit")


@analytics_router.get("/hourly-pattern/{department_id}")
async def hourly_pattern(
    department_id: int,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hourly arrival patterns averaged over the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(QueueObservation).where(
            QueueObservation.department_id == department_id,
            QueueObservation.timestamp >= since,
        ).order_by(QueueObservation.timestamp)
    )
    obs = result.scalars().all()

    hourly = {}
    for o in obs:
        h = o.timestamp.hour
        if h not in hourly:
            hourly[h] = {"arrivals": [], "waiting": [], "completions": []}
        hourly[h]["arrivals"].append(o.arrivals_in_interval)
        hourly[h]["waiting"].append(o.people_waiting)
        hourly[h]["completions"].append(o.completed_services)

    pattern = []
    for h in range(24):
        data = hourly.get(h, {"arrivals": [0], "waiting": [0], "completions": [0]})
        pattern.append({
            "hour": h,
            "avg_arrivals": sum(data["arrivals"]) / len(data["arrivals"]),
            "avg_waiting": sum(data["waiting"]) / len(data["waiting"]),
            "avg_completions": sum(data["completions"]) / len(data["completions"]),
        })
    return pattern


@analytics_router.get("/performance/{department_id}")
async def performance_summary(
    department_id: int,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            func.avg(QueueObservation.observed_waiting_time_seconds).label("avg_wait"),
            func.avg(QueueObservation.people_waiting).label("avg_queue"),
            func.sum(QueueObservation.arrivals_in_interval).label("total_arrivals"),
            func.sum(QueueObservation.completed_services).label("total_completions"),
            func.avg(QueueObservation.active_counters).label("avg_counters"),
        ).where(
            QueueObservation.department_id == department_id,
            QueueObservation.timestamp >= since,
        )
    )
    row = result.first()
    return {
        "avg_wait_minutes": (row.avg_wait or 0) / 60,
        "avg_queue_length": row.avg_queue or 0,
        "total_arrivals": row.total_arrivals or 0,
        "total_completions": row.total_completions or 0,
        "avg_active_counters": row.avg_counters or 0,
        "period_days": days,
    }


@analytics_router.get("/timeline/{department_id}")
async def timeline(
    department_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(QueueObservation).where(
            QueueObservation.department_id == department_id,
            QueueObservation.timestamp >= since,
        ).order_by(QueueObservation.timestamp)
    )
    obs = result.scalars().all()
    return [
        {
            "timestamp": o.timestamp.isoformat(),
            "people_waiting": o.people_waiting,
            "active_counters": o.active_counters,
            "arrivals": o.arrivals_in_interval,
            "completions": o.completed_services,
            "wait_minutes": (o.observed_waiting_time_seconds or 0) / 60,
        }
        for o in obs
    ]


# ─── Reports ─────────────────────────────────────────────────────────────────

@reports_router.get("/export/csv/{department_id}")
async def export_csv(
    department_id: int,
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import io, csv
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(QueueObservation).where(
            QueueObservation.department_id == department_id,
            QueueObservation.timestamp >= since,
        ).order_by(QueueObservation.timestamp)
    )
    obs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "department_id", "people_waiting", "active_counters",
                     "arrivals_in_interval", "completed_services", "avg_service_time_s",
                     "observed_waiting_time_s", "source"])
    for o in obs:
        writer.writerow([
            o.timestamp.isoformat(), o.department_id, o.people_waiting,
            o.active_counters, o.arrivals_in_interval, o.completed_services,
            o.avg_service_time_seconds, o.observed_waiting_time_seconds, o.source,
        ])

    content = output.getvalue()
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=qsense_dept{department_id}.csv"},
    )


@reports_router.get("/export/pdf/{department_id}")
async def export_pdf(
    department_id: int,
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as pdfcanvas
    from reportlab.lib import colors
    import io

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(QueueObservation).where(
            QueueObservation.department_id == department_id,
            QueueObservation.timestamp >= since,
        ).order_by(QueueObservation.timestamp)
    )
    obs = result.scalars().all()

    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, h - 60, "Q-Sense: Queue Performance Report")
    c.setFont("Helvetica", 12)
    c.drawString(50, h - 90, f"Department ID: {department_id}  |  Period: Last {hours}h")
    c.drawString(50, h - 110, f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    c.drawString(50, h - 130, f"Total Observations: {len(obs)}")
    c.setFont("Helvetica", 9)
    y = h - 160
    c.drawString(50, y, "Timestamp                    Waiting  Counters  Arrivals  Completions  Wait(s)")
    y -= 14
    c.line(50, y, w - 50, y)
    y -= 10
    for o in obs[:60]:  # max 60 rows in PDF
        if y < 60:
            c.showPage()
            y = h - 60
        line = f"{o.timestamp.strftime('%Y-%m-%d %H:%M'):<22} {o.people_waiting:<8} {o.active_counters:<9} {o.arrivals_in_interval:<9} {o.completed_services:<12} {o.observed_waiting_time_seconds or 0:<8.0f}"
        c.drawString(50, y, line)
        y -= 12

    c.setFont("Helvetica-Oblique", 8)
    c.drawString(50, 40, "Note: Data sourced from simulation. Not real government operational data.")
    c.save()
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=qsense_report_dept{department_id}.pdf"},
    )


# ─── Audit ───────────────────────────────────────────────────────────────────

@audit_router.get("", response_model=List[AuditLogOut])
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    )
    return result.scalars().all()


router.include_router(analytics_router)
router.include_router(reports_router)
router.include_router(audit_router)
