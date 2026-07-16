"""Auth endpoints — login, me, change password, forgot/reset password.

``/forgot-password`` stamps a reset token on the user row and mails the link
in a background task. With no SMTP configured the mailer logs the URL
instead, so an operator can still hand it over by hand.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Response,
    status,
)
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
from app.services.mailer import send_password_reset

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
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Stamp a reset token on the user row and mail the link.

    Always returns 204 (don't leak whether the email is registered). The mail
    goes out in a background task so SMTP latency doesn't leak the answer
    through the response time either.
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
        background.add_task(send_password_reset, to=user.email, reset_url=reset_url)
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
