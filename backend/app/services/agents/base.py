"""Shared abstractions for the multi-agent chat dispatcher.

Each agent is a `AgentDefinition` that knows how to:
  - declare its tools to Gemini
  - produce a system prompt for a given context
  - execute its tools against the database

The dispatcher (`dispatch.stream_agent`) drives a Gemini conversation, executes
tools, and yields SSE-friendly event dicts. The endpoint layer is responsible
for serializing them as `data: <json>\\n\\n`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Iterable, Sequence

from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prospect import Prospect
from app.models.segment import Segment
from app.schemas.chat import AgentContext, Mention


class ToolError(Exception):
    """Raised by tool handlers for recoverable, agent-visible errors."""


# A tool result is the value passed back to Gemini AS WELL AS to the client.
# Extra fields (`__object_block__`, `__prospect_update__`, `__actions_changed__`,
# `__error__`) are stripped before being sent back to the model — they're only
# interpreted by the dispatcher to emit side-effect events on the SSE stream.
ToolResult = dict[str, Any]


@dataclass
class AgentRunContext:
    """Per-request, per-turn execution context handed to tool handlers."""

    db: AsyncSession
    context: AgentContext
    mentions: list[Mention] = field(default_factory=list)
    prospect: Prospect | None = None
    segment: Segment | None = None
    mentioned_prospects: list[Prospect] = field(default_factory=list)
    mentioned_segments: list[Segment] = field(default_factory=list)
    # Per-conversation flags, mutable across hops in a single stream.
    flags: dict[str, Any] = field(default_factory=dict)


ToolHandler = Callable[[AgentRunContext, dict[str, Any]], Awaitable[ToolResult]]


@dataclass
class AgentDefinition:
    """Static description of an agent: id, prompt builder, tools."""

    id: str
    label: str
    scope: str  # "global" | "prospect" | "segment"
    build_system_prompt: Callable[[AgentRunContext], str]
    declarations: Callable[[], Sequence[types.FunctionDeclaration]]
    handlers: dict[str, ToolHandler]
    # Optional: name of a flag that, if truthy in run_ctx.flags, blocks
    # repeated calls to a given tool (used by fiche-editor's regenerate).
    once_tools: tuple[str, ...] = ()

    _cached_tools: list[types.Tool] | None = field(default=None, init=False, repr=False)

    def gemini_tools(self) -> list[types.Tool]:
        if self._cached_tools is None:
            decls = list(self.declarations())
            self._cached_tools = (
                [types.Tool(function_declarations=decls)] if decls else []
            )
        return self._cached_tools


async def list_segments_summary(ctx: AgentRunContext, _args: dict[str, Any]) -> ToolResult:
    """Shared `list_segments` handler used by multiple agents."""
    from sqlalchemy import select

    from app.models.segment import Segment

    res = await ctx.db.execute(select(Segment).order_by(Segment.created_at.desc()))
    out = [
        {
            "id": s.id,
            "nom": s.nom,
            "description": s.description,
            "taille_structure": s.taille_structure,
            "activite_ciblee": s.activite_ciblee,
            "zone_geographique": s.zone_geographique,
        }
        for s in res.scalars().all()
    ]
    return {"segments": out, "count": len(out)}


def merge_object_blocks(result: ToolResult) -> Iterable[dict[str, Any]]:
    """Pop and yield object-block side-effects embedded in a tool result."""
    blocks = result.pop("__object_blocks__", None) or []
    for blk in blocks:
        if not isinstance(blk, dict):
            continue
        kind = blk.get("kind")
        if not isinstance(kind, str):
            continue
        yield {"type": "object-block", "kind": kind, "data": blk.get("data")}


def pop_side_effects(result: ToolResult) -> tuple[bool, bool]:
    """Strip private side-effect flags from a tool result.

    Returns (prospect_updated, actions_touched).
    """
    prospect_updated = bool(result.pop("__prospect_update__", False))
    actions_touched = bool(result.pop("__actions_changed__", False))
    return prospect_updated, actions_touched
