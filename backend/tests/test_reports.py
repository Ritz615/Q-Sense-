"""
Automated unit tests: CSV and PDF Report Exports.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_csv_report_export(client: AsyncClient, admin_headers, seeded_dept):
    resp = await client.get(
        f"/api/v1/reports/export/csv/{seeded_dept.id}?hours=24",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert f"qsense_dept{seeded_dept.id}.csv" in resp.headers["content-disposition"]
    text = resp.text
    assert "timestamp" in text
    assert "people_waiting" in text


@pytest.mark.asyncio
async def test_pdf_report_export(client: AsyncClient, admin_headers, seeded_dept):
    resp = await client.get(
        f"/api/v1/reports/export/pdf/{seeded_dept.id}?hours=24",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")
    assert len(resp.content) > 500  # Non-trivial PDF file
