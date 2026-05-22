import asyncio
import json
import logging
from typing import Any, AsyncIterator, Awaitable, TypeVar

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import noload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.conversation import ChatMessage as ChatMessageModel
from app.models.conversation import Conversation
from app.models.entreprise import Entreprise
from app.models.prospect import Prospect  # noqa: F401 — used by other endpoints below
from app.models.segment import Segment
from app.schemas.chat import (
    ChatRequest,
    ConversationCreate,
    ConversationRead,
    ConversationSummary,
    ConversationUpdate,
)
from app.schemas.entreprise import EntrepriseRead
from app.services.agents import get_agent, list_agents, stream_agent
from app.services.enrichment import build_entreprise_fiche

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])

T = TypeVar("T")


async def _call_agent(action: str, ctx: Any, coro: Awaitable[T]) -> T:
    """Run an agent coroutine and translate failures to HTTP errors."""
    try:
        return await coro
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except Exception as exc:
        logger.exception("%s failed for %r", action, ctx)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{action} failed: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


@router.get("/catalog")
async def catalog() -> list[dict[str, str]]:
    return [
        {"id": a.id, "label": a.label, "scope": a.scope}
        for a in list_agents()
    ]


# ---------------------------------------------------------------------------
# Conversation CRUD
# ---------------------------------------------------------------------------


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    res = await db.execute(
        select(Conversation)
        .options(noload(Conversation.messages))
        .order_by(Conversation.updated_at.desc())
        .limit(200)
    )
    return list(res.scalars().all())


@router.post(
    "/conversations",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    if get_agent(payload.agent_id) is None:
        raise HTTPException(status_code=400, detail=f"Unknown agent {payload.agent_id}")
    conv = Conversation(
        agent_id=payload.agent_id,
        title=payload.title or "Nouvelle conversation",
        scope_kind=payload.scope_kind,
        scope_id=payload.scope_id,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/conversations/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    title = payload.title.strip() if payload.title else ""
    if title:
        conv.title = title
        await db.commit()
        await db.refresh(conv)
    return conv


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(delete(Conversation).where(Conversation.id == conversation_id))
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# Fiche regeneration
# ---------------------------------------------------------------------------


@router.post(
    "/entreprises/{entreprise_id}/regenerate-fiche",
    response_model=EntrepriseRead,
    response_model_by_alias=True,
)
async def regenerate_fiche_endpoint(
    entreprise_id: str,
    db: AsyncSession = Depends(get_db),
) -> Entreprise:
    entreprise = await db.get(Entreprise, entreprise_id)
    if entreprise is None:
        raise HTTPException(status_code=404, detail="Entreprise not found")

    segment: Segment | None = None
    if entreprise.segment_id:
        segment = await db.get(Segment, entreprise.segment_id)

    html, _sources, _queries = await _call_agent(
        "Fiche regeneration",
        entreprise_id,
        build_entreprise_fiche(entreprise, segment),
    )

    if html:
        entreprise.fiche_client = html
        await db.commit()
        await db.refresh(entreprise)
    return entreprise


# ---------------------------------------------------------------------------
# Streaming chat (generic, multi-agent, persisted)
# ---------------------------------------------------------------------------


def _truncate_title(text: str, limit: int = 64) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


async def _persist_user_turn(
    db: AsyncSession,
    conversation: Conversation,
    user_text: str,
) -> None:
    msg = ChatMessageModel(
        conversation_id=conversation.id,
        role="user",
        text=user_text,
    )
    db.add(msg)
    if not conversation.title or conversation.title == "Nouvelle conversation":
        conversation.title = _truncate_title(user_text) or conversation.title
    await db.commit()


async def _persist_assistant_turn(
    db: AsyncSession,
    conversation_id: str,
    text: str,
    parts: list[dict[str, Any]],
) -> None:
    msg = ChatMessageModel(
        conversation_id=conversation_id,
        role="assistant",
        text=text,
        parts=parts,
    )
    db.add(msg)
    await db.commit()


def _event_to_part(evt: dict[str, Any]) -> dict[str, Any] | None:
    t = evt.get("type")
    if t == "tool-call":
        return {
            "type": "tool-call",
            "toolCallId": evt.get("id"),
            "toolName": evt.get("name"),
            "args": evt.get("args") or {},
            "status": "running",
        }
    if t == "tool-result":
        return {"type": "tool-result-patch", "toolCallId": evt.get("id"), "result": evt.get("result")}
    if t == "object-block":
        return {"type": "object", "kind": evt.get("kind"), "data": evt.get("data")}
    return None


@router.post("/chat")
async def chat_endpoint(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Generic streaming chat. Routes to the agent identified by `agent_id`.

    Persists user + assistant turns onto the conversation referenced by
    `conversation_id`. The body of the request carries the FULL rolling
    history for the in-memory Gemini call — the DB persistence is a parallel
    side-effect for cross-device replay.
    """
    agent = get_agent(body.agent_id)
    if agent is None:
        raise HTTPException(status_code=400, detail=f"Unknown agent {body.agent_id}")

    conversation: Conversation | None = None
    if body.conversation_id:
        conversation = await db.get(Conversation, body.conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conversation.agent_id != body.agent_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Conversation {conversation.id} is bound to agent "
                    f"{conversation.agent_id}, not {body.agent_id}."
                ),
            )

    last_user = next(
        (m for m in reversed(body.messages) if m.role == "user"), None
    )
    if conversation is not None and last_user is not None:
        await _persist_user_turn(db, conversation, last_user.content)

    async def event_gen() -> AsyncIterator[str]:
        text_chunks: list[str] = []
        parts: list[dict[str, Any]] = []
        tool_index: dict[str, int] = {}

        agen = stream_agent(
            db,
            agent,
            body.context,
            body.mentions,
            body.messages,
        ).__aiter__()
        next_task: asyncio.Task | None = None
        try:
            while True:
                if next_task is None:
                    next_task = asyncio.ensure_future(agen.__anext__())
                done, _pending = await asyncio.wait({next_task}, timeout=10.0)
                if next_task in done:
                    try:
                        evt = next_task.result()
                    except StopAsyncIteration:
                        break
                    next_task = None
                    t = evt.get("type")
                    if t == "text-delta":
                        delta = evt.get("delta")
                        if isinstance(delta, str):
                            text_chunks.append(delta)
                    elif t == "tool-call":
                        part = _event_to_part(evt)
                        if part is not None:
                            tool_index[part["toolCallId"]] = len(parts)
                            parts.append(part)
                    elif t == "tool-result":
                        idx = tool_index.get(evt.get("id"))
                        if idx is not None:
                            result = evt.get("result")
                            parts[idx]["result"] = result
                            is_error = (
                                isinstance(result, dict) and "error" in result
                            )
                            parts[idx]["status"] = "error" if is_error else "done"
                    elif t == "object-block":
                        part = _event_to_part(evt)
                        if part is not None:
                            parts.append(part)
                    yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        except asyncio.CancelledError:
            logger.info("Chat stream cancelled")
            try:
                await db.rollback()
            except Exception:
                pass
            raise
        except Exception as exc:
            logger.exception("Chat stream failed")
            try:
                await db.rollback()
            except Exception:
                pass
            payload = {"type": "error", "message": str(exc)}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
        finally:
            if next_task is not None and not next_task.done():
                next_task.cancel()
                try:
                    await next_task
                except (asyncio.CancelledError, Exception):
                    pass
            if conversation is not None:
                text = "".join(text_chunks)
                # Always prepend the text as a part if present, in the natural
                # order: tool calls / object blocks come AFTER text in the
                # current Gemini stream pattern.
                final_parts: list[dict[str, Any]] = []
                if text:
                    final_parts.append({"type": "text", "text": text})
                final_parts.extend(parts)
                try:
                    await _persist_assistant_turn(
                        db, conversation.id, text, final_parts
                    )
                except Exception:
                    logger.exception("Failed to persist assistant turn")

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


