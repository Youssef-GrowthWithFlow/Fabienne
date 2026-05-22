from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.prospect import ProspectRead


class ActionKind(StrEnum):
    created = "created"
    message = "message"
    reply = "reply"
    meeting = "meeting"
    won = "won"
    lost = "lost"
    no_reply = "no_reply"
    discussion = "discussion"


class ActionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: ActionKind
    at: datetime | None = None
    meta: dict | None = Field(default=None, validation_alias="metadata")


class ActionRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    prospect_id: str = Field(alias="prospectId")
    kind: ActionKind
    at: datetime
    meta: dict | None = Field(default=None, serialization_alias="metadata")


class ActionWithProspectRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: ActionRead
    prospect: ProspectRead
