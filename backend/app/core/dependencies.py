"""
FastAPI dependency injection utilities.
Provides authenticated current user for route handlers.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    if str(sub).isdigit():
        result = await db.execute(select(User).where(User.id == int(sub)))
    else:
        result = await db.execute(select(User).where(User.username == str(sub)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return current_user


async def require_operator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator or administrator privileges required",
        )
    return current_user
