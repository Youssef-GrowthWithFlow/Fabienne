"""Pydantic schemas for the auth endpoints."""
from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str = ""
    is_active: bool
    is_admin: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class MeUpdateIn(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------


class UserCreateIn(BaseModel):
    email: EmailStr
    full_name: str = ""
    password: str = Field(min_length=8, max_length=128)
    is_admin: bool = False


class UserUpdateIn(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None


class AdminSetPasswordIn(BaseModel):
    """Admin sets a new password for another user, directly (no email step)."""

    password: str = Field(min_length=8, max_length=128)
