"""Auth endpoints — login, me, change password, forgot/reset password.

Password-reset emails are NOT sent here (no SMTP configured yet). The
``/forgot-password`` endpoint stamps a token on the user row and logs the
reset URL ; an operator can hand it to the user manually for now. When SMTP
is wired up later, the same flow will send the link by email.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordIn,
    ForgotPasswordIn,
    MeUpdateIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
)
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    issue_reset_token,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """OAuth2 password flow. ``username`` field carries the email."""
    user = (
        await db.execute(select(User).where(User.email == form.username.lower()))
    ).scalar_one_or_none()
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    token = create_access_token(user.id)
    return TokenOut(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: MeUpdateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None:
        new_email = payload.email.lower()
        if new_email != current_user.email:
            current_user.email = new_email
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email déjà utilisé") from exc
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/me/password", status_code=204, response_class=Response)
async def change_my_password(
    payload: ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    current_user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return Response(status_code=204)


@router.post("/forgot-password", status_code=204, response_class=Response)
async def forgot_password(
    payload: ForgotPasswordIn,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Stamp a reset token on the user row if it exists.

    Always returns 204 (don't leak whether the email is registered). When
    SMTP is configured later, this is where the email is sent. For now,
    the reset URL is logged at INFO level so an operator can retrieve it.
    """
    user = (
        await db.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if user is not None and user.is_active:
        token = issue_reset_token(user, settings.PASSWORD_RESET_EXPIRE_MINUTES)
        await db.commit()
        reset_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        )
        logger.info("Password reset requested for %s → %s", user.email, reset_url)
    return Response(status_code=204)


@router.post("/reset-password", status_code=204, response_class=Response)
async def reset_password(
    payload: ResetPasswordIn,
    db: AsyncSession = Depends(get_db),
) -> Response:
    user = (
        await db.execute(
            select(User).where(User.password_reset_token == payload.token)
        )
    ).scalar_one_or_none()
    if (
        user is None
        or user.password_reset_expires_at is None
        or user.password_reset_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien invalide ou expiré",
        )
    user.password_hash = hash_password(payload.password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    await db.commit()
    return Response(status_code=204)
