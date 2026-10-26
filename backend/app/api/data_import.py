"""
CSV data import and preprocessing API routes.
"""
import io, csv
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.queue import QueueObservation
from app.schemas.schemas import ImportSummary

router = APIRouter(prefix="/data", tags=["Data Import"])

REQUIRED_FIELDS = {"timestamp", "department_id"}
OPTIONAL_FIELDS = {
    "service_type", "arrivals", "people_waiting", "active_counters",
    "completed_services", "average_service_time_seconds",
    "observed_waiting_time_seconds", "counter_status",
}


@router.post("/import/csv", response_model=ImportSummary)
async def import_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.core.config import settings

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []

    warnings = []
    errors = []

    # Validate required columns
    missing = REQUIRED_FIELDS - set(fieldnames)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}")

    imported = 0
    rejected = 0
    preview = []
    rows = list(reader)

    for i, row in enumerate(rows):
        try:
            ts_raw = row.get("timestamp", "").strip()
            if not ts_raw:
                errors.append(f"Row {i+2}: Missing timestamp")
                rejected += 1
                continue

            try:
                from dateutil import parser as dp
                ts = dp.parse(ts_raw)
                if ts.tzinfo is None:
                    import pytz
                    ts = ts.replace(tzinfo=timezone.utc)
            except Exception:
                errors.append(f"Row {i+2}: Cannot parse timestamp '{ts_raw}'")
                rejected += 1
                continue

            try:
                dept_id = int(row.get("department_id", 0))
            except ValueError:
                errors.append(f"Row {i+2}: Invalid department_id")
                rejected += 1
                continue

            def safe_int(val, default=0):
                try:
                    return int(float(val)) if val and str(val).strip() else default
                except Exception:
                    return default

            def safe_float(val):
                try:
                    return float(val) if val and str(val).strip() else None
                except Exception:
                    return None

            obs = QueueObservation(
                department_id=dept_id,
                timestamp=ts,
                people_waiting=safe_int(row.get("people_waiting")),
                active_counters=safe_int(row.get("active_counters")),
                arrivals_in_interval=safe_int(row.get("arrivals")),
                completed_services=safe_int(row.get("completed_services")),
                avg_service_time_seconds=safe_float(row.get("average_service_time_seconds")),
                observed_waiting_time_seconds=safe_float(row.get("observed_waiting_time_seconds")),
                source="imported",
            )

            if not dry_run:
                db.add(obs)
            imported += 1

            if len(preview) < 5:
                preview.append(dict(row))

        except Exception as e:
            errors.append(f"Row {i+2}: Unexpected error: {str(e)}")
            rejected += 1

    if len(errors) > 20:
        errors = errors[:20]
        warnings.append("Only first 20 errors shown")

    return ImportSummary(
        total_rows=len(rows),
        imported_rows=imported,
        rejected_rows=rejected,
        warnings=warnings,
        errors=errors,
        preview=preview if dry_run else None,
    )


@router.get("/sample-csv")
async def download_sample_csv(current_user: User = Depends(get_current_user)):
    """Return a sample CSV template for data import."""
    sample = """timestamp,department_id,arrivals,people_waiting,active_counters,completed_services,average_service_time_seconds,observed_waiting_time_seconds
2024-01-15T09:00:00Z,1,8,12,3,6,280.0,420.0
2024-01-15T09:15:00Z,1,10,15,3,8,295.0,480.0
2024-01-15T09:30:00Z,1,12,18,4,10,310.0,540.0
2024-01-15T09:00:00Z,2,5,8,2,4,360.0,350.0
2024-01-15T09:15:00Z,2,7,10,2,5,370.0,400.0
"""
    from fastapi.responses import Response
    return Response(
        content=sample,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=qsense_import_template.csv"},
    )
