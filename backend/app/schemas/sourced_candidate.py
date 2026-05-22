"""Pydantic schemas for sourced candidate history."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SourcedStatus = Literal["pending", "validated", "refused"]


class SourcedCandidateRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    status: SourcedStatus
    segment_id: str | None = Field(default=None, serialization_alias="segmentId")
    instruction: str = ""
    # Full ProposedEntreprise snapshot (entreprise, ville, signaux, sources,
    # contacts, fieldSources, …) — returned to the frontend verbatim.
    payload: dict[str, Any] = Field(default_factory=dict)
    main_contact_index: int = Field(
        default=0, serialization_alias="mainContactIndex"
    )
    entreprise_id: str | None = Field(
        default=None, serialization_alias="entrepriseId"
    )
    prospect_id: str | None = Field(
        default=None, serialization_alias="prospectId"
    )
    created_at: datetime = Field(serialization_alias="createdAt")


class SourcerRunRequest(BaseModel):
    """Trigger a new sourcing run + persist its candidates."""

    model_config = ConfigDict(populate_by_name=True)

    segment_id: str | None = Field(default=None, alias="segmentId")
    count: int = Field(default=3, ge=1, le=10)
    instruction: str = ""


class SourcerRunResponse(BaseModel):
    candidates: list[SourcedCandidateRead] = Field(default_factory=list)
    search_queries: list[str] = Field(
        default_factory=list, serialization_alias="searchQueries"
    )


class SourcedCandidateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    main_contact_index: int | None = Field(
        default=None, alias="mainContactIndex"
    )
