"""
Pytest configuration and fixtures for Q-Sense backend testing.
"""
import sys
import os
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend and workspace to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
workspace_path = os.path.abspath(os.path.join(backend_path, ".."))
for p in (backend_path, workspace_path):
    if p not in sys.path:
        sys.path.insert(0, p)

from app.main import app
from app.database.session import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.operational import Department, Counter, Staff, StaffSkill
from app.models.queue import QueueObservation, CameraSource

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, future=True)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)



@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        username="admin_test",
        email="admintest@qsense.local",
        hashed_password=get_password_hash("TestAdminPass123"),
        full_name="Test Administrator",
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def operator_user(db_session: AsyncSession) -> User:
    user = User(
        username="operator_test",
        email="operatortest@qsense.local",
        hashed_password=get_password_hash("TestOpPass123"),
        full_name="Test Operator",
        role="operator",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict:
    token = create_access_token({"sub": str(admin_user.id), "role": admin_user.role, "user_id": admin_user.id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def operator_headers(operator_user: User) -> dict:
    token = create_access_token({"sub": str(operator_user.id), "role": operator_user.role, "user_id": operator_user.id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def seeded_dept(db_session: AsyncSession) -> Department:
    dept = Department(
        name="Verification Test Dept",
        code="VTD",
        description="Test department for unit tests",
        max_counters=6,
    )
    db_session.add(dept)
    await db_session.flush()

    for i in range(1, 4):
        c = Counter(
            department_id=dept.id,
            name=f"Counter {i}",
            number=i,
            status="open" if i < 3 else "closed",
        )
        db_session.add(c)

    await db_session.commit()
    await db_session.refresh(dept)
    return dept
