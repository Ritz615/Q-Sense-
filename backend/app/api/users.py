"""
User management API routes (admin only).
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.user import User
from app.models.analytics import AuditLog
from app.core.dependencies import get_current_user, require_admin
from app.core.security import get_password_hash
from app.schemas.schemas import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.username))
    return result.scalars().all()


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Check uniqueness
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    log = AuditLog(
        user_id=current_user.id,
        action="create_user",
        resource_type="user",
        resource_id=user.id,
        details={"username": user.username, "role": user.role},
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    await db.flush()
    await db.refresh(user)

    log = AuditLog(
        user_id=current_user.id,
        action="update_user",
        resource_type="user",
        resource_id=user_id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
