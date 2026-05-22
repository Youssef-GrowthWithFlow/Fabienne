"""Assistant agent: read-only Q&A over the whole pipeline.

Tools are scoped to SELECTs: list/get prospects, segments, actions. The agent
can also emit a `prospects-table` object-block for richer rendering on the
client.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from google.genai import types
from sqlalchemy import select

from app.models.action import Action
from app.models.entreprise import Entreprise
from app.models.prospect import Prospect
from app.models.segment import Segment
from app.services.agents.base import (
    AgentDefinition,
    AgentRunContext,
    ToolResult,
    list_segments_summary,
)
from app.services.gemini import format_segment_brief


SYSTEM_BASE = """\
Tu es l'assistant IA d'un commercial BtoB français. Tu as une vision globale
de son pipeline (prospects, segments, actions) et tu réponds à ses questions
en t'appuyant sur les données réelles.

Tu as plusieurs outils en lecture seule :
- `list_prospects(status?, segment_id?, relance_due?, limit?)` : retourne une
  table de prospects filtrée. Émet automatiquement un bloc visuel `prospects-table`.
- `get_prospect(id)` : retourne le détail complet d'un prospect.
- `list_segments()` : retourne la liste des segments avec leur brief résumé.
- `get_segment(id)` : retourne le détail d'un segment.
- `recent_actions(days?, limit?)` : retourne les actions récentes (passages
  de statut, RDV, etc.).

Règles :
1. Tu ne peux RIEN modifier — pas d'outil de mutation.
2. Appuie tes réponses sur les données retournées par tes outils. N'invente pas.
3. Si l'utilisateur demande une vue / un filtre / un tri (« mes prospects en
   discussion », « ceux à relancer cette semaine »), utilise `list_prospects`
   avec les bons filtres : ton appel produit un tableau visuel pour l'utilisateur.
4. Réponds en français, concis, en t'appuyant sur les chiffres.
"""


def build_system_prompt(run_ctx: AgentRunContext) -> str:
    parts = [SYSTEM_BASE.rstrip(), ""]
    if run_ctx.context.kind == "prospect" and run_ctx.prospect is not None:
        parts.append(f"Contexte : fiche prospect ouverte (id={run_ctx.prospect.id}).")
    elif run_ctx.context.kind == "segment" and run_ctx.segment is not None:
        parts.append(f"Contexte : segment ouvert ({run_ctx.segment.nom}).")
    else:
        parts.append("Contexte : vue globale.")
    if run_ctx.mentioned_prospects:
        labels = ", ".join(
            f"{p.nom or p.id} ({p.entreprise.entreprise if p.entreprise else '?'})"
            for p in run_ctx.mentioned_prospects
        )
        parts.append(f"Prospects mentionnés : {labels}.")
    if run_ctx.mentioned_segments:
        labels = ", ".join(s.nom or s.id for s in run_ctx.mentioned_segments)
        parts.append(f"Segments mentionnés : {labels}.")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Tool declarations
# ---------------------------------------------------------------------------


def _build_declarations() -> list[types.FunctionDeclaration]:
    list_prospects = types.FunctionDeclaration(
        name="list_prospects",
        description=(
            "Liste les prospects de l'utilisateur. Retourne une table que le client "
            "affiche en composant natif. Utilise des filtres pour cibler une vue."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "status": types.Schema(
                    type=types.Type.STRING,
                    description=(
                        "Statut exact (ex: 'À contacter', 'RDV', 'Client'). "
                        "Omettre pour tous statuts."
                    ),
                    nullable=True,
                ),
                "segment_id": types.Schema(
                    type=types.Type.STRING, nullable=True
                ),
                "relance_due": types.Schema(
                    type=types.Type.BOOLEAN,
                    description=(
                        "Si true, ne retient que les prospects avec une relance_date "
                        "<= aujourd'hui."
                    ),
                    nullable=True,
                ),
                "limit": types.Schema(
                    type=types.Type.INTEGER, nullable=True
                ),
            },
        ),
    )
    get_prospect = types.FunctionDeclaration(
        name="get_prospect",
        description="Retourne le détail d'un prospect par id.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"id": types.Schema(type=types.Type.STRING)},
            required=["id"],
        ),
    )
    list_segments = types.FunctionDeclaration(
        name="list_segments",
        description="Retourne tous les segments avec leur brief court.",
        parameters=types.Schema(type=types.Type.OBJECT, properties={}),
    )
    get_segment = types.FunctionDeclaration(
        name="get_segment",
        description="Retourne le brief complet d'un segment.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"id": types.Schema(type=types.Type.STRING)},
            required=["id"],
        ),
    )
    recent_actions = types.FunctionDeclaration(
        name="recent_actions",
        description="Actions récentes (passages de statut, messages, etc.).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "days": types.Schema(type=types.Type.INTEGER, nullable=True),
                "limit": types.Schema(type=types.Type.INTEGER, nullable=True),
            },
        ),
    )
    return [list_prospects, get_prospect, list_segments, get_segment, recent_actions]


_DECLARATIONS = _build_declarations()


def _declarations() -> list[types.FunctionDeclaration]:
    return _DECLARATIONS


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


def _prospect_row(p: Prospect) -> dict[str, Any]:
    ent = p.entreprise
    return {
        "id": p.id,
        "nom": p.nom,
        "entreprise": ent.entreprise if ent else "",
        "status": p.status,
        "segment": ent.segment_id if ent else None,
        "relance_date": p.relance_date.isoformat() if p.relance_date else None,
    }


def _prospect_detail(p: Prospect) -> dict[str, Any]:
    ent = p.entreprise
    return {
        "id": p.id,
        "nom": p.nom,
        "role": p.role,
        "entreprise_id": p.entreprise_id,
        "entreprise": ent.entreprise if ent else "",
        "status": p.status,
        "segment": ent.segment_id if ent else None,
        "email": p.email,
        "telephone": p.telephone,
        "linkedin": p.linkedin,
        "site_web_entreprise": ent.site_web if ent else "",
        "ville_entreprise": ent.ville if ent else "",
        "taille_entreprise": ent.taille if ent else "",
        "ca_entreprise": ent.ca if ent else "",
        "origine_entreprise": ent.origine if ent else "",
        "signaux_entreprise": (ent.signaux if ent else []),
        "relance_date": p.relance_date.isoformat() if p.relance_date else None,
        "contacted_at": p.contacted_at.isoformat() if p.contacted_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


async def _do_list_prospects(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    stmt = select(Prospect)
    status = args.get("status")
    if isinstance(status, str) and status:
        stmt = stmt.where(Prospect.status == status)
    segment_id = args.get("segment_id")
    if isinstance(segment_id, str) and segment_id:
        stmt = stmt.join(
            Entreprise, Entreprise.id == Prospect.entreprise_id
        ).where(Entreprise.segment_id == segment_id)
    if args.get("relance_due"):
        today = date.today()
        stmt = stmt.where(Prospect.relance_date.is_not(None)).where(
            Prospect.relance_date <= today
        )
    limit_raw = args.get("limit")
    limit = int(limit_raw) if isinstance(limit_raw, (int, float)) else 50
    limit = max(1, min(limit, 200))
    stmt = stmt.order_by(Prospect.created_at.desc()).limit(limit)

    res = await ctx.db.execute(stmt)
    rows = [_prospect_row(p) for p in res.scalars().all()]

    object_block = {
        "kind": "prospects-table",
        "data": {
            "view": {
                "filter": {
                    "status": status,
                    "segment_id": segment_id,
                    "relance_due": bool(args.get("relance_due")),
                },
                "sort": "created_at desc",
            },
            "columns": ["Nom", "Entreprise", "Statut", "Segment"],
            "rows": rows,
        },
    }
    return {
        "count": len(rows),
        "summary": [
            {"nom": r["nom"], "entreprise": r["entreprise"], "status": r["status"]}
            for r in rows[:10]
        ],
        "__object_blocks__": [object_block],
    }


async def _do_get_prospect(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    pid = args.get("id")
    if not isinstance(pid, str) or not pid:
        return {"error": "Argument 'id' requis."}
    p = await ctx.db.get(Prospect, pid)
    if p is None:
        return {"error": f"Prospect {pid} introuvable."}
    return _prospect_detail(p)


async def _do_get_segment(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    sid = args.get("id")
    if not isinstance(sid, str) or not sid:
        return {"error": "Argument 'id' requis."}
    s = await ctx.db.get(Segment, sid)
    if s is None:
        return {"error": f"Segment {sid} introuvable."}
    return {"id": s.id, "nom": s.nom, "brief": format_segment_brief(s)}


async def _do_recent_actions(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    days_raw = args.get("days")
    days = int(days_raw) if isinstance(days_raw, (int, float)) else 14
    days = max(1, min(days, 90))
    limit_raw = args.get("limit")
    limit = int(limit_raw) if isinstance(limit_raw, (int, float)) else 30
    limit = max(1, min(limit, 100))

    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(Action)
        .where(Action.at >= since)
        .order_by(Action.at.desc())
        .limit(limit)
    )
    res = await ctx.db.execute(stmt)
    actions = res.scalars().all()
    out: list[dict[str, Any]] = []
    for a in actions:
        out.append({
            "id": a.id,
            "prospect_id": a.prospect_id,
            "kind": a.kind,
            "at": a.at.isoformat() if a.at else None,
        })
    return {"actions": out, "count": len(out), "since_days": days}


AGENT = AgentDefinition(
    id="assistant",
    label="Assistant Q&A",
    scope="global",
    build_system_prompt=build_system_prompt,
    declarations=_declarations,
    handlers={
        "list_prospects": _do_list_prospects,
        "get_prospect": _do_get_prospect,
        "list_segments": list_segments_summary,
        "get_segment": _do_get_segment,
        "recent_actions": _do_recent_actions,
    },
)
