"""Admin endpoints to manage application users.

Every route is gated by ``require_admin`` — only an admin can list, create,
edit, disable or password-reset other users.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AdminResetPasswordOut,
    UserCreateIn,
    UserOut,
    UserUpdateIn,
)
from app.services.auth import hash_password, issue_reset_token, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/users",
    tags=["users"],
    # Every endpoint here is admin-only — declared once at the router level.
    dependencies=[Depends(require_admin)],
)


async def _get_or_404(db: AsyncSession, user_id: str) -> User:
    try:
        uid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    user = await db.get(User, uid)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[User]:
    res = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(res.scalars().all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateIn,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        is_admin=payload.is_admin,
        is_active=True,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un utilisateur avec cet email existe déjà.",
        ) from exc
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    payload: UserUpdateIn,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await _get_or_404(db, user_id)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_or_404(db, user_id)
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu ne peux pas supprimer ton propre compte.",
        )
    await db.delete(user)
    await db.commit()
    return None


@router.post(
    "/{user_id}/reset-password",
    response_model=AdminResetPasswordOut,
)
async def admin_reset_password(
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> AdminResetPasswordOut:
    """Issue a single-use reset token and return the full reset URL.

    Same flow as ``/auth/forgot-password`` but bypasses the email step :
    the admin gets the URL back directly so it can be handed to the user
    (until SMTP is wired up).
    """
    user = await _get_or_404(db, user_id)
    token = issue_reset_token(user, settings.PASSWORD_RESET_EXPIRE_MINUTES)
    await db.commit()
    reset_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    )
    logger.info("Admin reset for %s → %s", user.email, reset_url)
    return AdminResetPasswordOut(reset_url=reset_url)
