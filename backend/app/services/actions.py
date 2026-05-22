"""Business logic for logging actions: insert Action + mirror Comment +
sync prospect status, contacted_at, relance_date according to simple
prospection rules.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import Action
from app.models.comment import Comment
from app.models.prospect import Prospect


KIND_TO_STATUS: dict[str, str] = {
    "message": "Contacté",
    "reply": "Répondu",
    "discussion": "En discussion",
    "meeting": "RDV",
    "won": "Client",
    "lost": "Refus",
    "no_reply": "Sans réponse",
}

STATUS_RANK: dict[str, int] = {
    "À contacter": 0,
    "Contacté": 1,
    "Répondu": 2,
    "En discussion": 3,
    "RDV": 4,
    "Client": 5,
    "Sans réponse": 1,
    "Refus": -1,
}

# Statuses that should override the current one regardless of rank
TERMINAL_KINDS = {"lost", "no_reply"}

# Kinds that close the prospect → no further relance needed
CLOSED_KINDS = {"won", "lost"}


def kind_to_comment_text(kind: str, metadata: dict | None) -> str:
    m = metadata or {}
    if kind == "message":
        platform = m.get("platform", "")
        message = m.get("message", "")
        prefix = f"Message {platform}".rstrip()
        return f"{prefix} — {message}" if message else prefix
    if kind == "reply":
        platform = m.get("platform", "")
        message = m.get("message", "")
        prefix = f"Réponse {platform}".rstrip()
        return f"{prefix} — {message}" if message else prefix
    if kind == "meeting":
        date = m.get("date", "")
        description = m.get("description", "")
        if date and description:
            return f"RDV le {date} — {description}"
        if date:
            return f"RDV le {date}"
        return f"RDV pris — {description}" if description else "RDV pris"
    if kind == "won":
        goal = m.get("goal", "")
        reason = m.get("reason", "")
        parts = ["Client gagné"]
        if goal:
            parts.append(f"pour {goal}")
        if reason:
            parts.append(f"parce que {reason}")
        return " — ".join(parts)
    if kind == "lost":
        return "Refus"
    if kind == "no_reply":
        return "Sans réponse"
    if kind == "discussion":
        return "En discussion"
    if kind == "created":
        return "Prospect créé"
    # transition fallback
    to_status = m.get("to")
    if to_status:
        return f"Statut → {to_status}"
    return kind


async def log_action(
    db: AsyncSession,
    prospect: Prospect,
    kind: str,
    metadata: dict | None = None,
    at: datetime | None = None,
) -> Action:
    """Insert an Action, mirror it as a Comment, and apply business rules
    to the prospect (status, contacted_at, relance_date).

    The caller is responsible for committing the session.
    """
    action_kwargs: dict = {
        "prospect_id": prospect.id,
        "kind": kind,
        "meta": metadata,
    }
    if at is not None:
        action_kwargs["at"] = at
    action = Action(**action_kwargs)
    db.add(action)
    await db.flush()  # populate action.id and action.at

    comment = Comment(
        prospect_id=prospect.id,
        action_id=action.id,
        date=action.at,
        texte=kind_to_comment_text(kind, metadata),
    )
    db.add(comment)

    target_status = KIND_TO_STATUS.get(kind)
    if target_status is not None:
        cur_rank = STATUS_RANK.get(prospect.status, -1)
        new_rank = STATUS_RANK.get(target_status, -1)
        if kind in TERMINAL_KINDS or new_rank > cur_rank:
            prospect.status = target_status

    if prospect.status != "À contacter" and prospect.contacted_at is None:
        prospect.contacted_at = action.at.date()

    if kind in CLOSED_KINDS:
        prospect.relance_date = None
    elif kind != "created":
        prospect.relance_date = (action.at + timedelta(days=7)).date()

    return action
