"""
Automated unit tests: Department, Counter, Staff CRUD operations.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_and_create_department(client: AsyncClient, admin_headers):
    # Create department
    create_payload = {
        "name": "Social Welfare Services",
        "code": "SWS",
        "description": "Pensions and civic support",
        "max_counters": 5,
    }
    resp = await client.post("/api/v1/departments", json=create_payload, headers=admin_headers)
    assert resp.status_code == 201
    created = resp.json()
    assert created["name"] == "Social Welfare Services"
    dept_id = created["id"]

    # List departments
    list_resp = await client.get("/api/v1/departments", headers=admin_headers)
    assert list_resp.status_code == 200
    depts = list_resp.json()
    assert any(d["id"] == dept_id for d in depts)


@pytest.mark.asyncio
async def test_counter_crud(client: AsyncClient, admin_headers, seeded_dept):
    # Create counter
    counter_payload = {
        "department_id": seeded_dept.id,
        "name": "Express Counter 9",
        "number": 9,
        "opening_time": "09:00",
        "closing_time": "17:00",
    }
    resp = await client.post("/api/v1/counters", json=counter_payload, headers=admin_headers)
    assert resp.status_code == 201
    counter_id = resp.json()["id"]

    # Update counter status
    patch_resp = await client.patch(
        f"/api/v1/counters/{counter_id}",
        json={"status": "maintenance"},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "maintenance"


@pytest.mark.asyncio
async def test_operator_cannot_create_department(client: AsyncClient, operator_headers):
    # Operators lack admin privileges
    payload = {"name": "Unauthorized Dept", "code": "UNAUTH", "max_counters": 2}
    resp = await client.post("/api/v1/departments", json=payload, headers=operator_headers)
    assert resp.status_code == 403
