from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Wire types for the chat streaming endpoint
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    """A single message in the rolling chat history sent to the model."""

    role: Literal["user", "assistant"]
    content: str = ""


AgentScope = Literal["global", "prospect", "segment"]


class AgentContext(BaseModel):
    """Where the conversation is anchored — drives system prompt + tool scope."""

    kind: AgentScope = "global"
    id: str | None = None


MentionKind = Literal["prospect", "segment"]


class Mention(BaseModel):
    kind: MentionKind
    id: str


class ChatRequest(BaseModel):
    """Generic request body for POST /agents/chat."""

    agent_id: str
    conversation_id: str | None = None
    context: AgentContext = Field(default_factory=AgentContext)
    mentions: list[Mention] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Persistence types
# ---------------------------------------------------------------------------


class MessagePartText(BaseModel):
    type: Literal["text"] = "text"
    text: str


class MessagePartToolCall(BaseModel):
    type: Literal["tool-call"] = "tool-call"
    tool_call_id: str = Field(alias="toolCallId")
    tool_name: str = Field(alias="toolName")
    args: dict[str, Any] = Field(default_factory=dict)
    result: Any | None = None
    status: Literal["running", "done", "error"] = "done"

    model_config = ConfigDict(populate_by_name=True)


class MessagePartObject(BaseModel):
    type: Literal["object"] = "object"
    kind: str
    data: Any


MessagePart = MessagePartText | MessagePartToolCall | MessagePartObject


class ChatMessageRead(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    text: str
    parts: list[MessagePart] = Field(default_factory=list)
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("parts", mode="before")
    @classmethod
    def _coerce_parts(cls, v: Any) -> Any:
        if v is None:
            return []
        return v


class ConversationRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    title: str
    scope_kind: AgentScope = Field(alias="scopeKind")
    scope_id: str | None = Field(default=None, alias="scopeId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    messages: list[ChatMessageRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ConversationSummary(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    title: str
    scope_kind: AgentScope = Field(alias="scopeKind")
    scope_id: str | None = Field(default=None, alias="scopeId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ConversationCreate(BaseModel):
    agent_id: str
    title: str | None = None
    scope_kind: AgentScope = "global"
    scope_id: str | None = None


class ConversationUpdate(BaseModel):
    title: str
