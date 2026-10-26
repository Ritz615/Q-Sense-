"""
Automated unit tests: CSV Data Import and Preprocessing Validation.
"""
import pytest
import io
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_import_valid_csv(client: AsyncClient, admin_headers, seeded_dept):
    csv_content = (
        "timestamp,department_id,service_type,arrivals,people_waiting,active_counters,completed_services,average_service_time_seconds,observed_waiting_time_seconds\n"
        f"2026-10-26T10:00:00Z,{seeded_dept.id},CDS,12,8,3,4,300,240\n"
        f"2026-10-26T10:15:00Z,{seeded_dept.id},CDS,15,11,3,5,280,310\n"
    ).encode("utf-8")

    files = {"file": ("test_import.csv", io.BytesIO(csv_content), "text/csv")}
    resp = await client.post("/api/v1/data/import/csv", files=files, headers=admin_headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["total_rows"] == 2
    assert summary["imported_rows"] == 2
    assert summary["rejected_rows"] == 0


@pytest.mark.asyncio
async def test_import_missing_required_column(client: AsyncClient, admin_headers):
    # Missing department_id
    bad_csv = "timestamp,arrivals,people_waiting\n2026-10-26T10:00:00Z,5,2\n".encode("utf-8")
    files = {"file": ("bad.csv", io.BytesIO(bad_csv), "text/csv")}
    resp = await client.post("/api/v1/data/import/csv", files=files, headers=admin_headers)
    assert resp.status_code == 400
    assert "Missing required columns" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_import_dry_run(client: AsyncClient, admin_headers, seeded_dept):
    csv_content = (
        "timestamp,department_id,arrivals,people_waiting\n"
        f"2026-10-26T11:00:00Z,{seeded_dept.id},10,5\n"
    ).encode("utf-8")

    files = {"file": ("dry_run.csv", io.BytesIO(csv_content), "text/csv")}
    resp = await client.post("/api/v1/data/import/csv?dry_run=true", files=files, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["imported_rows"] == 1
