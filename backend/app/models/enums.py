"""Shared enums / typed literals used across models and schemas."""
from __future__ import annotations

from typing import Literal

FieldSource = Literal[
    "api_gouv",
    "ai_grounding",
    "ai_grounding_verified",
    "finess",
    "ordre",
    "google_places",
    "dropcontact",
    "manual",
    "gemini",
]

FIELD_SOURCES: tuple[str, ...] = (
    "api_gouv",
    "ai_grounding",
    "ai_grounding_verified",
    "finess",
    "ordre",
    "google_places",
    "dropcontact",
    "manual",
    "gemini",
)
