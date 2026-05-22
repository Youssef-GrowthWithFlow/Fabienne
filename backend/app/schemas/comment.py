from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    date: datetime
    texte: str = ""


class CommentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: datetime | None = None
    texte: str = ""


class CommentUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: datetime | None = None
    texte: str | None = None


class CommentRead(CommentBase):
    id: str
    action_id: str | None = Field(default=None, serialization_alias="actionId")
