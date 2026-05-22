"""Streaming dispatcher: routes a chat request to the right agent definition,
drives the Gemini conversation, executes tools, and yields SSE events.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncIterator
from uuid import uuid4

from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.prospect import Prospect
from app.models.segment import Segment
from app.schemas.chat import AgentContext, ChatMessage, Mention
from app.schemas.prospect import ProspectRead
from app.services.agents.base import (
    AgentDefinition,
    AgentRunContext,
    ToolError,
    merge_object_blocks,
    pop_side_effects,
)
from app.services.gemini import get_client

logger = logging.getLogger(__name__)

MAX_TOOL_HOPS = 6
MAX_HISTORY_MESSAGES = 20
MAX_HISTORY_TEXT_CHARS = 4000


# ---------------------------------------------------------------------------
# Agent registry
# ---------------------------------------------------------------------------

_REGISTRY: dict[str, AgentDefinition] = {}


def register_agent(agent: AgentDefinition) -> None:
    _REGISTRY[agent.id] = agent


def get_agent(agent_id: str) -> AgentDefinition | None:
    return _REGISTRY.get(agent_id)


def list_agents() -> list[AgentDefinition]:
    return list(_REGISTRY.values())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"… [tronqué, {len(text)} caractères]"


def _messages_to_contents(messages: list[ChatMessage]) -> list[types.Content]:
    trimmed = messages[-MAX_HISTORY_MESSAGES:]
    contents: list[types.Content] = []
    for msg in trimmed:
        role = "user" if msg.role == "user" else "model"
        text = msg.content or ""
        if len(text) > MAX_HISTORY_TEXT_CHARS:
            text = _truncate(text, MAX_HISTORY_TEXT_CHARS)
        contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    return contents


def _prospect_payload(prospect: Prospect) -> dict[str, Any]:
    return ProspectRead.model_validate(prospect).model_dump(
        by_alias=True, mode="json"
    )


async def _resolve_context(
    db: AsyncSession, context: AgentContext, mentions: list[Mention]
) -> tuple[Prospect | None, Segment | None, list[Prospect], list[Segment]]:
    prospect: Prospect | None = None
    segment: Segment | None = None
    if context.kind == "prospect" and context.id:
        prospect = await db.get(Prospect, context.id)
        if prospect and prospect.entreprise and prospect.entreprise.segment_id:
            segment = await db.get(Segment, prospect.entreprise.segment_id)
    elif context.kind == "segment" and context.id:
        segment = await db.get(Segment, context.id)

    mentioned_prospects: list[Prospect] = []
    mentioned_segments: list[Segment] = []
    for m in mentions:
        if m.kind == "prospect":
            p = await db.get(Prospect, m.id)
            if p is not None and (prospect is None or p.id != prospect.id):
                mentioned_prospects.append(p)
        elif m.kind == "segment":
            s = await db.get(Segment, m.id)
            if s is not None and (segment is None or s.id != segment.id):
                mentioned_segments.append(s)
    return prospect, segment, mentioned_prospects, mentioned_segments


# ---------------------------------------------------------------------------
# Main streaming loop
# ---------------------------------------------------------------------------


async def stream_agent(
    db: AsyncSession,
    agent: AgentDefinition,
    context: AgentContext,
    mentions: list[Mention],
    messages: list[ChatMessage],
) -> AsyncIterator[dict[str, Any]]:
    """Yield SSE-friendly events for a single chat turn.

    Each yielded dict has a `type` field. The endpoint serializes them as
    `data: <json>\\n\\n`.
    """
    client: genai.Client = get_client()

    prospect, segment, mp, ms = await _resolve_context(db, context, mentions)
    run_ctx = AgentRunContext(
        db=db,
        context=context,
        mentions=mentions,
        prospect=prospect,
        segment=segment,
        mentioned_prospects=mp,
        mentioned_segments=ms,
    )

    model_name = settings.GEMINI_CHAT_MODEL or settings.GEMINI_MODEL
    tools = agent.gemini_tools()
    system_instruction = agent.build_system_prompt(run_ctx)

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.4,
        tools=tools if tools else None,
        # Chat agents lean on tool calls + short text replies — no extended
        # thinking needed (Gemini 3.x equivalent of legacy thinking_budget=0).
        thinking_config=types.ThinkingConfig(thinking_level="minimal"),
    )

    contents = _messages_to_contents(messages)

    for _hop in range(MAX_TOOL_HOPS):
        function_calls: list[types.FunctionCall] = []
        # Preserve the raw Parts emitted by the model so we can echo them back
        # verbatim on the next hop — Gemini 3.x requires `thought_signature`
        # on each tool-related Part to keep the reasoning chain alive.
        assistant_parts: list[types.Part] = []

        stream = await client.aio.models.generate_content_stream(
            model=model_name,
            contents=contents,
            config=config,
        )

        async for chunk in stream:
            for cand in (getattr(chunk, "candidates", None) or []):
                content = getattr(cand, "content", None)
                if content is None:
                    continue
                for part in (getattr(content, "parts", None) or []):
                    assistant_parts.append(part)
                    if getattr(part, "thought", False):
                        continue
                    text = getattr(part, "text", None)
                    if text:
                        yield {"type": "text-delta", "delta": text}
                    fc = getattr(part, "function_call", None)
                    if fc is not None and getattr(fc, "name", None):
                        function_calls.append(fc)

        if assistant_parts:
            contents.append(types.Content(role="model", parts=assistant_parts))

        if not function_calls:
            break

        response_parts: list[types.Part] = []
        actions_touched_round = False
        for fc in function_calls:
            call_id = uuid4().hex
            name = fc.name
            args = dict(fc.args or {})

            if name in agent.once_tools and run_ctx.flags.get(f"used:{name}"):
                result: dict[str, Any] = {
                    "error": (
                        f"`{name}` déjà utilisé dans cette conversation. "
                        "Limite à 1 par session."
                    )
                }
                yield {"type": "tool-call", "id": call_id, "name": name, "args": args}
                yield {"type": "tool-result", "id": call_id, "result": result}
                response_parts.append(
                    types.Part.from_function_response(name=name, response=result)
                )
                continue

            yield {"type": "tool-call", "id": call_id, "name": name, "args": args}

            handler = agent.handlers.get(name)
            if handler is None:
                result = {"error": f"outil inconnu: {name}"}
                yield {"type": "tool-result", "id": call_id, "result": result}
                response_parts.append(
                    types.Part.from_function_response(name=name, response=result)
                )
                continue

            try:
                if run_ctx.prospect is not None:
                    await db.refresh(run_ctx.prospect)
                result = await handler(run_ctx, args)
            except ToolError as exc:
                await db.rollback()
                result = {"error": str(exc)}
            except Exception:
                logger.exception("tool %s failed", name)
                await db.rollback()
                result = {"error": "Erreur interne lors de l'exécution de l'outil."}

            object_events = list(merge_object_blocks(result))
            prospect_updated, actions_touched = pop_side_effects(result)
            if not result.get("error") and name in agent.once_tools:
                run_ctx.flags[f"used:{name}"] = True

            yield {"type": "tool-result", "id": call_id, "result": result}
            for evt in object_events:
                yield evt
            response_parts.append(
                types.Part.from_function_response(name=name, response=result)
            )

            if prospect_updated and run_ctx.prospect is not None:
                yield {
                    "type": "prospect-update",
                    "prospect": _prospect_payload(run_ctx.prospect),
                }
            if actions_touched:
                actions_touched_round = True

        if actions_touched_round:
            yield {"type": "actions-changed"}

        contents.append(types.Content(role="user", parts=response_parts))
    else:
        yield {
            "type": "error",
            "message": "Trop d'appels d'outils consécutifs. Réessaye plus simplement.",
        }

    yield {"type": "done"}


# Eagerly register the built-in agents so dispatch is ready at import time.
# Imports are at the bottom to avoid circular dependencies.
from app.services.agents import (  # noqa: E402  (registry side-effects)
    assistant,
    fiche_editor,
)

register_agent(fiche_editor.AGENT)
register_agent(assistant.AGENT)
