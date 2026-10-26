"""
Automated unit tests: Authentication, JWT creation, and role-based permissions.
"""
import pytest
from httpx import AsyncClient
from app.core.security import verify_password, get_password_hash


def test_password_hashing():
    pw = "SecureGovPass2026!"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin_test", "password": "TestAdminPass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "admin"
    assert data["username"] == "admin_test"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin_test", "password": "IncorrectPassword"},
    )
    assert resp.status_code == 401
    assert "Incorrect" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient, admin_headers):
    resp = await client.get("/api/v1/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin_test"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_protected_route_without_token(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)
