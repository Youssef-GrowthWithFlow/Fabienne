"""Fiche-editor agent: scoped to a single prospect, owns the 3 mutation tools."""
from __future__ import annotations

import asyncio
from datetime import date
from typing import Any, Callable

from google.genai import types

from app.models.prospect import Prospect
from app.services.actions import KIND_TO_STATUS, log_action
from app.services.agents.base import (
    AgentDefinition,
    AgentRunContext,
    ToolError,
    ToolResult,
)
from app.services.enrichment import (
    _clean_fiche_html,
    build_entreprise_fiche,
)
from app.services.gemini import format_segment_brief


STATUSES: list[str] = [
    "À contacter",
    "Contacté",
    "Répondu",
    "En discussion",
    "RDV",
    "Client",
    "Sans réponse",
    "Refus",
]

_STATUS_TO_KIND = {v: k for k, v in KIND_TO_STATUS.items()}


def _str_parser(v: Any) -> tuple[bool, Any]:
    if v is None:
        return True, ""
    if isinstance(v, str):
        return True, v
    return False, None


def _optstr_parser(v: Any) -> tuple[bool, Any]:
    if v is None or v == "":
        return True, None
    if isinstance(v, str):
        return True, v
    return False, None


def _status_parser(v: Any) -> tuple[bool, Any]:
    if not isinstance(v, str) or v not in STATUSES:
        return False, None
    return True, v


def _date_parser(v: Any) -> tuple[bool, Any]:
    if v is None or v == "":
        return True, None
    if isinstance(v, str):
        try:
            return True, date.fromisoformat(v)
        except ValueError:
            return False, None
    return False, None


EDITABLE_FIELDS: dict[str, Callable[[Any], tuple[bool, Any]]] = {
    "nom": _str_parser,
    "role": _str_parser,
    "status": _status_parser,
    "email": _str_parser,
    "telephone": _str_parser,
    "linkedin": _optstr_parser,
    "relance_date": _date_parser,
}


# ---------------------------------------------------------------------------
# Tool declarations
# ---------------------------------------------------------------------------


def _build_declarations() -> list[types.FunctionDeclaration]:
    properties: dict[str, types.Schema] = {
        "nom": types.Schema(type=types.Type.STRING),
        "role": types.Schema(type=types.Type.STRING),
        "status": types.Schema(
            type=types.Type.STRING,
            description="Statut du prospect dans le funnel commercial.",
            enum=list(STATUSES),
        ),
        "email": types.Schema(type=types.Type.STRING),
        "telephone": types.Schema(type=types.Type.STRING),
        "linkedin": types.Schema(type=types.Type.STRING, nullable=True),
        "relance_date": types.Schema(
            type=types.Type.STRING,
            description="Date au format ISO YYYY-MM-DD. null pour retirer.",
            nullable=True,
        ),
    }

    update_fields = types.FunctionDeclaration(
        name="update_prospect_fields",
        description=(
            "Met à jour partiellement les champs scalaires du prospect. "
            "Ne mets que les champs à modifier."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT, properties=properties
        ),
    )

    update_fiche = types.FunctionDeclaration(
        name="update_fiche_html",
        description=(
            "Remplace intégralement la fiche client HTML. Balises autorisées : "
            "h2, h3, p, ul, li, strong, em."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "html": types.Schema(type=types.Type.STRING),
            },
            required=["html"],
        ),
    )

    regenerate = types.FunctionDeclaration(
        name="regenerate_fiche",
        description=(
            "Régénère intégralement la fiche en lançant une recherche Google "
            "(15-45s). Limité à 1 appel par conversation."
        ),
        parameters=types.Schema(type=types.Type.OBJECT, properties={}),
    )

    return [update_fields, update_fiche, regenerate]


_DECLARATIONS = _build_declarations()


def _declarations() -> list[types.FunctionDeclaration]:
    return _DECLARATIONS


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_BASE = """\
Tu es l'assistant IA d'un commercial BtoB français qui travaille la fiche d'un prospect.
Tu reçois en permanence l'état actuel du prospect et le brief du segment commercial.

Tu as 3 outils :
- `update_prospect_fields(updates)` : pour modifier les champs scalaires du prospect.
- `update_fiche_html(html)` : pour réécrire la fiche client HTML sans recherche web.
- `regenerate_fiche()` : pour régénérer entièrement la fiche avec recherche Google (lent, 1 fois par conversation).

Règles strictes :
1. Si l'utilisateur demande une modification d'un champ, tu DOIS appeler `update_prospect_fields`.
2. Pour une question sans demande de modif, réponds simplement en texte (français, concis).
3. La fiche HTML utilise UNIQUEMENT les balises h2, h3, p, ul, li, strong, em. Pas de markdown.
4. Préfère `update_fiche_html` à `regenerate_fiche` (lent/coûteux).
5. Tu réponds toujours en français.
"""


def _format_prospect_snapshot(prospect: Prospect) -> str:
    ent = prospect.entreprise
    # Fiche client lives on entreprise. Include a short excerpt so the agent
    # can reason about its current content without bloating the prompt.
    full = (ent.fiche_client if ent else "") or ""
    fiche = full if len(full) <= 600 else full[:600] + f"… (tronquée, {len(full)} chars au total)"
    lines = [
        f"id: {prospect.id}",
        f"nom: {prospect.nom!r}",
        f"role: {prospect.role!r}",
        f"entreprise: {(ent.entreprise if ent else '')!r}",
        f"entreprise_id: {prospect.entreprise_id!r}",
        f"segment_id: {(ent.segment_id if ent else None)!r}",
        f"ville entreprise: {(ent.ville if ent else '')!r}",
        f"site web entreprise: {(ent.site_web if ent else '')!r}",
        f"taille entreprise: {(ent.taille if ent else '')!r}",
        f"ca entreprise: {(ent.ca if ent else '')!r}",
        f"origine entreprise: {(ent.origine if ent else '')!r}",
        f"status: {prospect.status!r}",
        f"email: {prospect.email!r}",
        f"telephone: {prospect.telephone!r}",
        f"linkedin: {prospect.linkedin!r}",
        f"signaux entreprise: {(ent.signaux if ent else [])!r}",
        f"created_at: {prospect.created_at}",
        f"contacted_at: {prospect.contacted_at}",
        f"relance_date: {prospect.relance_date}",
        f"fiche_client entreprise (HTML, extrait): {fiche!r}",
    ]
    return "\n".join(lines)


def build_system_prompt(run_ctx: AgentRunContext) -> str:
    parts = [SYSTEM_BASE.rstrip(), ""]
    if run_ctx.prospect is None:
        parts.append(
            "⚠ Aucun prospect en contexte. Demande à l'utilisateur d'ouvrir une fiche "
            "prospect avant toute modification."
        )
        return "\n".join(parts)
    parts.append("État actuel du prospect :")
    parts.append(_format_prospect_snapshot(run_ctx.prospect))
    parts.append("")
    parts.append("Brief du segment commercial :")
    parts.append(format_segment_brief(run_ctx.segment))
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


async def _do_update_fields(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    prospect = ctx.prospect
    if prospect is None:
        raise ToolError("Aucun prospect en contexte.")
    if not isinstance(args, dict):
        raise ToolError("Arguments invalides : objet attendu.")

    applied: dict[str, Any] = {}
    errors: dict[str, str] = {}
    old_status = prospect.status

    for key, value in args.items():
        parser = EDITABLE_FIELDS.get(key)
        if parser is None:
            errors[key] = "champ non modifiable par l'agent"
            continue
        ok, parsed = parser(value)
        if not ok:
            errors[key] = "valeur invalide"
            continue
        setattr(prospect, key, parsed)
        applied[key] = value

    if not applied and errors:
        return {"applied": {}, "errors": errors}

    new_status = prospect.status
    if old_status != new_status and new_status in _STATUS_TO_KIND:
        await log_action(
            ctx.db,
            prospect,
            kind=_STATUS_TO_KIND[new_status],
            metadata={"from": old_status, "to": new_status},
        )

    await ctx.db.commit()
    result: ToolResult = {"applied": applied}
    if errors:
        result["errors"] = errors
    if old_status != new_status:
        result["status_changed"] = {"from": old_status, "to": new_status}
        result["__actions_changed__"] = True
    result["__prospect_update__"] = True
    return result


async def _do_update_fiche(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    prospect = ctx.prospect
    if prospect is None:
        raise ToolError("Aucun prospect en contexte.")
    entreprise = prospect.entreprise
    if entreprise is None:
        raise ToolError(
            "Aucune entreprise rattachée au prospect : impossible de modifier "
            "la fiche (la fiche vit au niveau de l'entreprise)."
        )
    html = args.get("html")
    if not isinstance(html, str):
        raise ToolError("Argument 'html' requis (chaîne).")
    cleaned = _clean_fiche_html(html)
    entreprise.fiche_client = cleaned
    await ctx.db.commit()
    return {"ok": True, "length": len(cleaned), "__prospect_update__": True}


async def _do_regenerate_fiche(ctx: AgentRunContext, args: dict[str, Any]) -> ToolResult:
    prospect = ctx.prospect
    if prospect is None:
        raise ToolError("Aucun prospect en contexte.")
    entreprise = prospect.entreprise
    if entreprise is None:
        raise ToolError(
            "Aucune entreprise rattachée au prospect : impossible de "
            "régénérer la fiche."
        )
    segment = ctx.segment
    if segment is None and entreprise.segment_id:
        from app.models.segment import Segment

        segment = await ctx.db.get(Segment, entreprise.segment_id)

    html, _sources, _queries = await asyncio.shield(
        build_entreprise_fiche(
            entreprise,
            segment,
            contact_nom=prospect.nom or "",
            contact_role=prospect.role or "",
        )
    )
    if html:
        entreprise.fiche_client = html
        await ctx.db.commit()
        return {"ok": True, "length": len(html), "__prospect_update__": True}
    return {"ok": False, "error": "Le modèle n'a renvoyé aucun contenu."}


AGENT = AgentDefinition(
    id="fiche-editor",
    label="Éditeur de fiche client",
    scope="prospect",
    build_system_prompt=build_system_prompt,
    declarations=_declarations,
    handlers={
        "update_prospect_fields": _do_update_fields,
        "update_fiche_html": _do_update_fiche,
        "regenerate_fiche": _do_regenerate_fiche,
    },
    once_tools=("regenerate_fiche",),
)
