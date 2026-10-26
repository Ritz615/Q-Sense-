"""
Authentication API routes.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.user import User
from app.models.analytics import AuditLog
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.schemas.schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    db.add(user)

    # Audit log
    log = AuditLog(
        user_id=user.id,
        action="login",
        resource_type="user",
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        role=user.role,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = AuditLog(
        user_id=current_user.id,
        action="logout",
        resource_type="user",
        resource_id=current_user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    return {"message": "Logged out successfully"}
