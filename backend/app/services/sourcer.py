"""Sourcer service: one-shot Gemini call that proposes Entreprises for a segment.

Used by `POST /api/v1/entreprises/generate`. Stateless — no DB writes here;
the endpoint commits a validated subset via `/bulk`.

The Gemini call uses **structured outputs** (`response_schema`) combined with
Google Search grounding (supported in Gemini 3.x). This guarantees a JSON
payload conforming to `_SourcerResponse` without needing fragile text parsing.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Awaitable, Callable

from google.genai import types
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.entreprise import Entreprise
from app.models.finess import FinessEtablissement
from app.models.sourced_candidate import SourcedCandidate
from app.schemas.entreprise import (
    DirigeantSchema,
    GenerateEntreprisesResponse,
    GroundingRef,
    ProposedContact,
    ProposedEntreprise,
)
from app.services import api_entreprise, google_places
from app.services.api_entreprise import ApiGouvEnrichment, _normalize as _normalize_for_match
from app.services.enrichment import fetch_supplemental_contacts
from app.services.google_places import GooglePlacesEnrichment
from app.services.ordre_lookup import lookup_pharmaciens
from app.services.gemini import (
    extract_sources,
    format_segment_brief,
    get_client,
)

logger = logging.getLogger(__name__)


MAX_CONTACTS_PER_CANDIDATE = 3


# ---------------------------------------------------------------------------
# Schema for Gemini structured outputs
# ---------------------------------------------------------------------------
#
# Field names match what the prompt asks of the model (snake_case). We keep
# these models separate from the API-facing `ProposedEntreprise` (which carries
# camelCase aliases for the frontend) and map between them after parsing.


class _SourcerContact(BaseModel):
    nom: str = ""
    role: str = ""


class _SourcerCandidate(BaseModel):
    entreprise: str = ""
    site_web: str = ""
    secteur: str = ""
    ville: str = ""
    taille: str = ""
    raison: str = ""
    signaux: list[str] = []
    contacts: list[_SourcerContact] = []


class _SourcerResponse(BaseModel):
    candidates: list[_SourcerCandidate] = []


SOURCER_USER_PROMPT = """\
Tu es un agent de sourcing commercial BtoB français. Mission : trouver
{count} ENTREPRISES françaises pour la requête utilisateur ci-dessous.

Requête utilisateur :
« {instruction} »
{segment_section}{finess_section}{exclude_section}
Réponds **uniquement** par un bloc JSON entre des fences ```json``` et
```, sous la forme :
```json
{{ "candidates": [ {{ ... }}, {{ ... }} ] }}
```
Pas de texte avant ou après le bloc.

Pour chaque entreprise, propose :
- `entreprise` (nom officiel),
- `site_web` (URL canonique si trouvée, sinon chaîne vide),
- `secteur`, `ville`, `taille` (effectif estimé sous forme de fourchette,
  ex. "11-50"),
- `raison` (1 phrase qui justifie le match avec la requête et le segment),
- `signaux` : 2 à 5 tags TRÈS COURTS (max 4 mots chacun) qui résument
  POURQUOI cette entreprise matche. Privilégie les faits concrets : levée
  de fonds récente, recrutement actif, transfert, ouverture, certif,
  reprise, partenariat nommé, chiffre clé, etc. **Pas de phrases**.
  Ex : ["Reprise en 2024", "Levée 2M€", "Ouverture 2e site"].
- `contacts` : liste de 0 à 3 contacts identifiables PUBLIQUEMENT
  (dirigeant, responsable identifié publiquement). Pour chacun : `nom` et
  `role` uniquement. **N'invente JAMAIS un contact**. **Aucun email,
  téléphone ou URL** : ces données viendront d'un autre canal.

Règles strictes :
1. **IMPÉRATIF — grounding obligatoire** : tu n'as PAS le droit de
   répondre depuis tes seules connaissances. Avant TOUT écrit, lance au
   minimum **3 recherches Google ciblées** (nom d'entreprise + ville,
   actualité récente, dirigeants publics). Chaque entreprise proposée
   doit s'appuyer sur des résultats de recherche actuels. Sans recherche,
   pas de candidat.
2. Pas d'hallucinations : si tu n'es pas sûr d'un champ, laisse-le vide.
   **N'écris JAMAIS d'URL** (LinkedIn, article, fiche) : les sources
   réelles sont récupérées du grounding Google Search côté serveur.
3. Réponds en français.
4. Si rien d'utile ne ressort, retourne `candidates: []`.
5. **Si la requête utilisateur contredit le brief du segment**
   (localisation, taille, secteur), **la requête prime systématiquement**.
   Le brief sert uniquement à enrichir les champs non couverts par la
   requête (signaux qualitatifs, must-have, pain points).
"""


FINESS_SECTION_TEMPLATE = """
Données FINESS officielles (référentiel data.gouv.fr — VÉRITÉ TERRAIN
pour les noms, adresses, catégories) :
{records}

**Priorise ces établissements pour la sélection** : chaque candidat que
tu proposes doit idéalement venir de cette liste. Tu peux compléter par
Google Search uniquement si :
- le besoin utilisateur n'est pas couvert par cette liste,
- ou pour enrichir un établissement FINESS avec des signaux (actualité,
  contacts publics, levée, transfert récent…).

N'invente PAS un nom d'établissement absent du FINESS : utilise la
raison sociale longue (`rslongue`) telle qu'elle apparaît dans le
référentiel.
"""


_DEPT_CODE_RE = re.compile(r"\((\d{2})\)|\b(\d{2})\b")
_CITY_TO_DEPT = {
    "toulouse": "31", "montpellier": "34", "perpignan": "66",
    "nîmes": "30", "nimes": "30", "albi": "81", "rodez": "12",
    "montauban": "82", "auch": "32", "cahors": "46", "tarbes": "65",
    "carcassonne": "11", "mende": "48", "foix": "09",
    "marseille": "13", "aix-en-provence": "13", "avignon": "84",
    "pau": "64", "bayonne": "64", "agen": "47", "périgueux": "24",
    "valence": "26",  # voisin
    "le puy": "43", "aurillac": "15", "privas": "07",
}


def _detect_departments(haystack: str) -> list[str]:
    found: set[str] = set()
    for city, dept in _CITY_TO_DEPT.items():
        if city in haystack:
            found.add(dept)
    # Aussi : codes département explicites dans l'instruction « (31) » ou « 31 ».
    for m in _DEPT_CODE_RE.finditer(haystack):
        code = m.group(1) or m.group(2)
        if code:
            found.add(code)
    return sorted(found)


async def _finess_shortlist(
    db: AsyncSession, segment, instruction: str, limit: int = 80
) -> list[FinessEtablissement]:
    """Return up to `limit` FINESS records matching the segment + instruction.

    Category filtering uses each entry in ``segment.activite_ciblee`` as a
    case-insensitive substring match (OR-combined); location filtering uses
    department codes / city names found in the instruction + the segment's
    ``zone_geographique`` + descriptive fields. Falls back to "no filter" on
    either axis if nothing is provided.
    """
    activite_terms = [
        s.strip()
        for s in (getattr(segment, "activite_ciblee", None) or [])
        if s and s.strip()
    ]
    zone_terms = [
        s.strip()
        for s in (getattr(segment, "zone_geographique", None) or [])
        if s and s.strip()
    ]

    haystack = " ".join(
        s.lower()
        for s in [
            instruction or "",
            getattr(segment, "description", "") or "",
            getattr(segment, "nom", "") or "",
            " ".join(activite_terms),
            " ".join(zone_terms),
            " ".join(getattr(segment, "postes", []) or []),
        ]
    )

    dept_codes = _detect_departments(haystack)

    stmt = select(FinessEtablissement)
    if activite_terms:
        stmt = stmt.where(
            or_(
                *[
                    FinessEtablissement.lib_categetab.ilike(f"%{term}%")
                    for term in activite_terms
                ]
            )
        )
    if dept_codes:
        stmt = stmt.where(FinessEtablissement.departement.in_(dept_codes))

    stmt = stmt.order_by(
        FinessEtablissement.datemaj.desc().nullslast()
    ).limit(limit)

    res = await db.execute(stmt)
    records = list(res.scalars().all())
    logger.info(
        "FINESS shortlist: %d records (activite=%s, depts=%s)",
        len(records),
        activite_terms or "ALL",
        dept_codes or "ALL",
    )
    return records


# ---------------------------------------------------------------------------
# Exclusion of entreprises déjà en base
# ---------------------------------------------------------------------------


# Capped to keep the prompt readable. The post-enrichment filter still
# catches duplicates even if the model didn't see them in this list.
_EXCLUDE_PROMPT_LIMIT = 30


async def _load_existing_index(
    db: AsyncSession,
) -> tuple[set[str], set[str]]:
    """Return (sirets, normalized_names) of leads to NEVER re-propose.

    Validated entreprises (the real Entreprise table) + refused candidates.
    Pending candidates are excluded from the index intentionally: they
    haven't been acted on yet, and keeping them in the exclude list shrinks
    each new run to almost nothing once the history grows.
    """
    sirets: set[str] = set()
    names: set[str] = set()

    ent_rows = await db.execute(
        select(Entreprise.siret, Entreprise.entreprise)
    )
    for siret, name in ent_rows.all():
        if siret:
            sirets.add(siret)
        key = _normalize_for_match(name or "")
        if key:
            names.add(key)

    sc_rows = await db.execute(
        select(SourcedCandidate.payload).where(
            SourcedCandidate.status == "refused"
        )
    )
    for (payload,) in sc_rows.all():
        if not isinstance(payload, dict):
            continue
        siret = payload.get("siret")
        if siret:
            sirets.add(siret)
        key = _normalize_for_match(payload.get("entreprise") or "")
        if key:
            names.add(key)

    return sirets, names


def _attribute_sources(
    name: str, grounded: list,
) -> list[GroundingRef]:
    """Pick up to 3 grounding chunks for a candidate.

    ``grounded`` is what ``extract_sources(response)`` returned — real URLs
    from Google Search (as vertexaisearch redirect URLs). We rank chunks
    that mention a name token (title or URI) ahead of the rest, then fill
    up to 3 with the remaining batch-wide chunks. This guarantees the user
    always sees actual sources, even when title/URI don't match the name.
    """
    name_tokens = {
        t for t in _normalize_for_match(name).split()
        if len(t) > 2 and t not in {"sas", "sarl", "sa", "eurl", "sci", "snc"}
    }
    matched: list[GroundingRef] = []
    others: list[GroundingRef] = []
    seen_uris: set[str] = set()
    for chunk in grounded:
        title_raw = getattr(chunk, "title", "") or ""
        uri = getattr(chunk, "uri", "") or ""
        if not uri or uri in seen_uris:
            continue
        seen_uris.add(uri)
        ref = GroundingRef(title=title_raw or uri, uri=uri)
        haystack = _normalize_for_match(f"{title_raw} {uri}")
        if name_tokens and any(tok in haystack for tok in name_tokens):
            matched.append(ref)
        else:
            others.append(ref)
    return (matched + others)[:3]


def _format_exclude_block(names: set[str]) -> str:
    if not names:
        return ""
    sample = sorted(names)[:_EXCLUDE_PROMPT_LIMIT]
    suffix = (
        f"\n…et {len(names) - _EXCLUDE_PROMPT_LIMIT} autres."
        if len(names) > _EXCLUDE_PROMPT_LIMIT
        else ""
    )
    bullets = "\n".join(f"- {n}" for n in sample)
    return (
        "\nEntreprises DÉJÀ EN BASE (à NE PAS reproposer) :\n"
        f"{bullets}{suffix}\n"
    )


def _is_existing(
    candidate: ProposedEntreprise,
    sirets: set[str],
    names: set[str],
) -> bool:
    if candidate.siret and candidate.siret in sirets:
        return True
    key = _normalize_for_match(candidate.entreprise or "")
    return bool(key) and key in names


def _format_finess_block(records: list[FinessEtablissement]) -> str:
    if not records:
        return ""
    lines = []
    for r in records:
        nom = r.rslongue or r.rs or "(sans nom)"
        loc = ", ".join(p for p in (r.adresse, r.ligne_acheminement) if p)
        tel = f" — tél {r.telephone}" if r.telephone else ""
        siret = f" — SIRET {r.siret}" if r.siret else ""
        lines.append(
            f"- [FINESS {r.nofinesset}] {nom} — {r.lib_categetab} — {loc}{tel}{siret}"
        )
    return FINESS_SECTION_TEMPLATE.format(records="\n".join(lines))


def _opt_str(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    return ""


def _to_proposed_contact(c: _SourcerContact | dict) -> ProposedContact | None:
    if isinstance(c, _SourcerContact):
        nom, role = _opt_str(c.nom), _opt_str(c.role)
    elif isinstance(c, dict):
        nom, role = _opt_str(c.get("nom")), _opt_str(c.get("role"))
    else:
        return None
    if not nom and not role:
        return None
    return ProposedContact(nom=nom, role=role)


def _coerce_signaux(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        s = _opt_str(item)
        if s:
            out.append(s)
    return out[:6]


def _to_proposed_entreprise(
    c: _SourcerCandidate | dict,
) -> ProposedEntreprise | None:
    if isinstance(c, _SourcerCandidate):
        data = {
            "entreprise": _opt_str(c.entreprise),
            "site_web": _opt_str(c.site_web),
            "secteur": _opt_str(c.secteur),
            "ville": _opt_str(c.ville),
            "taille": _opt_str(c.taille),
            "raison": _opt_str(c.raison),
        }
        contacts_raw = c.contacts
        signaux = _coerce_signaux(c.signaux)
    elif isinstance(c, dict):
        data = {
            "entreprise": _opt_str(c.get("entreprise")),
            "site_web": _opt_str(c.get("site_web")),
            "secteur": _opt_str(c.get("secteur")),
            "ville": _opt_str(c.get("ville")),
            "taille": _opt_str(c.get("taille")),
            "raison": _opt_str(c.get("raison")),
        }
        contacts_raw = c.get("contacts") or []
        signaux = _coerce_signaux(c.get("signaux"))
    else:
        return None

    if not data["entreprise"]:
        return None

    contacts: list[ProposedContact] = []
    for item in contacts_raw or []:
        nc = _to_proposed_contact(item)
        if nc is not None:
            contacts.append(nc)
        if len(contacts) >= MAX_CONTACTS_PER_CANDIDATE:
            break

    return ProposedEntreprise(
        contacts=contacts, signaux=signaux, **data,
    )


def _finish_reason(response) -> str:
    cands = getattr(response, "candidates", None) or []
    if not cands:
        return ""
    reason = getattr(cands[0], "finish_reason", None)
    return getattr(reason, "name", str(reason)) if reason is not None else ""


def _usage(response) -> str:
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return "no_usage"
    return (
        f"prompt={getattr(usage, 'prompt_token_count', None)} "
        f"candidates={getattr(usage, 'candidates_token_count', None)} "
        f"thoughts={getattr(usage, 'thoughts_token_count', None)} "
        f"total={getattr(usage, 'total_token_count', None)}"
    )


_CANDIDATES_ARRAY_RE = re.compile(r'"candidates"\s*:\s*\[')


def _salvage_complete_objects(text: str) -> list[dict]:
    """Salvage balanced `{...}` candidate objects from a (possibly truncated)
    Gemini structured-output response.

    Gemini sometimes returns `{"candidates": [...]}` but stops mid-Nth
    candidate, leaving the outer wrapper unclosed. We can't rely on the outer
    `}` ever appearing, so we anchor on `"candidates": [` and scan candidates
    inside that array, treating each balanced `{...}` at depth 1 (relative to
    that opening bracket) as a recoverable candidate.

    Strings (with escaped quotes) are respected so braces inside text values
    don't fool the depth counter.
    """
    m = _CANDIDATES_ARRAY_RE.search(text)
    body_start = m.end() if m else 0
    body = text[body_start:]

    out: list[dict] = []
    depth = 0
    in_str = False
    escape = False
    start = -1
    for i, c in enumerate(body):
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            if depth == 0:
                start = i
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                slice_ = body[start : i + 1]
                try:
                    obj = json.loads(slice_)
                except json.JSONDecodeError:
                    start = -1
                    continue
                if isinstance(obj, dict):
                    out.append(obj)
                start = -1
    return out


def _parse_response(response) -> list[Any]:
    """Return the raw candidates list from a Gemini structured-output response.

    1. Prefer `response.parsed` (populated when the SDK successfully parses
       against `response_schema`).
    2. Else try `json.loads(response.text)` for clean output.
    3. Else salvage all complete `{...}` objects from the truncated text —
       Gemini sometimes stops mid-candidate (`finish_reason=STOP` even with
       a generous `max_output_tokens`), and we'd rather show N-1 candidates
       than throw the whole batch away.
    """
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, _SourcerResponse):
        cands = list(parsed.candidates)
        if cands:
            return cands
    if isinstance(parsed, dict):
        raw = parsed.get("candidates")
        if isinstance(raw, list) and raw:
            return raw

    raw_text = getattr(response, "text", "") or ""
    if not raw_text:
        return []

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        salvaged = _salvage_complete_objects(raw_text)
        candidate_like = [s for s in salvaged if "entreprise" in s]
        if candidate_like:
            logger.info(
                "Sourcer salvaged %d candidates from truncated JSON "
                "(finish_reason=%s, usage=[%s], text_len=%d).",
                len(candidate_like),
                _finish_reason(response),
                _usage(response),
                len(raw_text),
            )
            return candidate_like
        logger.warning(
            "Sourcer JSON parse failed and no objects salvageable "
            "(finish_reason=%s, usage=[%s], text_len=%d). End: %r",
            _finish_reason(response),
            _usage(response),
            len(raw_text),
            raw_text[-800:],
        )
        return []

    if isinstance(data, dict):
        raw = data.get("candidates")
        if isinstance(raw, list):
            return raw
    if isinstance(data, list):
        return data
    return []


ProgressFn = Callable[[dict[str, Any]], Awaitable[None]]


async def _noop_progress(_event: dict[str, Any]) -> None:  # pragma: no cover
    return None


async def generate_entreprises(
    db: AsyncSession,
    segment,
    instruction: str,
    count: int,
    progress: ProgressFn = _noop_progress,
) -> GenerateEntreprisesResponse:
    """Call Gemini with Google Search grounding + structured output.

    When `segment.data_sources` contains `'finess'`, a deterministic shortlist
    of FINESS établissements is pre-loaded from the local table and injected
    into the prompt as ground truth — the model picks from it rather than
    hallucinating raison sociale / category / address.

    ``progress`` is an optional async callback receiving ``{phase, message, ...}``
    events at every key phase. Used by the streaming endpoint to push SSE
    updates to the UI. Defaults to a no-op for backward compat.
    """
    client = get_client()
    # Ask Gemini for a few extra candidates to cover post-enrichment drops
    # (SIRET collisions, fuzzy-name dupes) and still hit the user's target.
    target_count = min(count + 3, 12)

    await progress({
        "phase": "loading_history",
        "message": "Chargement de l'historique des entreprises…",
    })
    existing_sirets, existing_names = await _load_existing_index(db)
    exclude_section = _format_exclude_block(existing_names)
    finess_section = ""
    finess_records: list[FinessEtablissement] = []
    finess_enabled = (
        segment is not None
        and "finess" in (getattr(segment, "data_sources", None) or [])
    )
    if finess_enabled:
        await progress({
            "phase": "finess_shortlist",
            "message": "Lecture du référentiel FINESS…",
        })
        finess_records = await _finess_shortlist(db, segment, instruction)
        finess_section = _format_finess_block(finess_records)
    segment_section = (
        f"\nSegment cible :\n{format_segment_brief(segment)}\n"
        if segment is not None
        else ""
    )
    user_message = SOURCER_USER_PROMPT.format(
        count=target_count,
        instruction=instruction.strip() or "(aucune instruction fournie)",
        segment_section=segment_section,
        finess_section=finess_section,
        exclude_section=exclude_section,
    )

    # `response_mime_type="application/json"` makes Gemini drop
    # `grounding_chunks` from grounding_metadata (even though it still
    # searches — `web_search_queries` is populated). Without mime_type, the
    # chunks are returned. We instruct the prompt to wrap JSON in ```json
    # fences ; the salvage parser anchors on `"candidates": [` so it works
    # equally with or without fences.
    #
    # Gemini 3.x: ``thinking_budget`` is deprecated, replaced by
    # ``thinking_level``. Sourcing NEEDS ``"high"`` — empirically ``"medium"``
    # often skips google_search entirely, leaving grounding empty and the
    # candidates ungrounded (pulled from pre-training only). "high" forces
    # the deliberation that triggers search reliably.
    config = types.GenerateContentConfig(
        temperature=0.3,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        thinking_config=types.ThinkingConfig(thinking_level="high"),
    )

    await progress({
        "phase": "gemini_sourcing",
        "message": "Recherche IA — Gemini + Google Search…",
        "detail": f"Cible : {target_count} candidat(s)",
    })

    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_SOURCING_MODEL,
            contents=user_message,
            config=config,
        )
    except Exception as exc:  # noqa: BLE001 — translate to caller
        logger.exception("sourcer.generate_entreprises failed")
        raise RuntimeError(f"Recherche IA échouée : {exc}") from exc

    candidates_raw = _parse_response(response)

    candidates: list[ProposedEntreprise] = []
    for item in candidates_raw:
        pe = _to_proposed_entreprise(item)
        if pe is None:
            continue
        # Pre-emit name-dedup: Gemini sometimes re-proposes a company already
        # in DB despite the exclude list. Drop here so the UI never flashes a
        # card that will later disappear. SIRET-dedup still happens
        # post-enrichment (api_gouv may reveal a known SIRET behind a new name).
        if _normalize_for_match(pe.entreprise or "") in existing_names:
            logger.info(
                "Sourcer: pre-emit drop name-dup %r", pe.entreprise,
            )
            continue
        candidates.append(pe)
        if len(candidates) >= target_count:
            break

    if not candidates:
        logger.warning(
            "Sourcer returned 0 candidates. finish_reason=%s usage=[%s]. "
            "Raw end (truncated): %r",
            _finish_reason(response),
            _usage(response),
            (getattr(response, "text", "") or "")[-1500:],
        )

    # Enrich each candidate in parallel: API gouv + segment-driven supplemental
    # contact lookup grounded on public web (driven by segment.postes /
    # ai_sources / sourcing instruction). Misses keep the Gemini values intact
    # with field_sources marked "gemini".
    if candidates:
        finess_by_name: dict[str, FinessEtablissement] = {}
        for rec in finess_records:
            key = _normalize_for_match(rec.rslongue or rec.rs or "")
            if key:
                finess_by_name.setdefault(key, rec)

        # Stream raw candidates BEFORE enrichment. The UI renders each one as
        # a skeleton card immediately; per-candidate enrichment events flow
        # in as patches that "fill in" the card progressively. This is the
        # main UX win — perceived latency drops from ~30 s to ~7 s.
        for c in candidates:
            await progress({
                "phase": "candidate_raw",
                "temp_id": c.temp_id,
                "data": c.model_dump(by_alias=True, mode="json"),
            })

        total = len(candidates)
        await progress({
            "phase": "enriching",
            "message": (
                f"Enrichissement de {total} candidat(s) "
                "(api_gouv, Google Places, Ordre, Gemini)…"
            ),
            "current": 0,
            "total": total,
        })

        done_count = 0

        async def _enrich_with_progress(c: ProposedEntreprise) -> ProposedEntreprise:
            nonlocal done_count
            result = await _enrich_candidate(
                c, finess_by_name or None, segment, instruction, db,
            )
            # Preserve the temp_id assigned at generation so the UI can
            # match this patch against the raw card it already rendered.
            result.temp_id = c.temp_id
            done_count += 1
            await progress({
                "phase": "candidate_enriched",
                "temp_id": c.temp_id,
                "current": done_count,
                "total": total,
                "data": result.model_dump(by_alias=True, mode="json"),
            })
            return result

        enriched_all = await asyncio.gather(
            *[_enrich_with_progress(c) for c in candidates]
        )

        # Drop any candidate that resolves to an entreprise already in DB —
        # match first by SIRET (definitive — api_gouv may have just attached
        # one), fall back to normalized name (in case api_gouv/FINESS
        # renamed the entreprise into an existing one).
        candidates = []
        for c in enriched_all:
            if _is_existing(c, existing_sirets, existing_names):
                logger.info(
                    "Sourcer: post-enrich drop dup %r (siret=%s)",
                    c.entreprise, c.siret,
                )
                await progress({
                    "phase": "candidate_dropped",
                    "temp_id": c.temp_id,
                })
                continue
            candidates.append(c)
        # Truncate to the user's requested count after compensating for drops.
        if len(candidates) > count:
            for extra in candidates[count:]:
                await progress({
                    "phase": "candidate_dropped",
                    "temp_id": extra.temp_id,
                })
            candidates = candidates[:count]

    sources, queries = extract_sources(response)
    logger.info(
        "Sourcer grounding (%s): %d chunks, %d queries (candidates=%d)",
        settings.GEMINI_SOURCING_MODEL,
        len(sources), len(queries), len(candidates),
    )

    # Per-candidate source attribution from the SOURCING Gemini call's
    # actual grounding chunks. We MERGE with any URLs the enrichment agent
    # also visited (set on c.sources by _enrich_candidate) so the user sees
    # both pipelines' visited URLs. Dedup by URI.
    if candidates and sources:
        for c in candidates:
            sourcing_picks = _attribute_sources(c.entreprise, sources)
            already = {ref.uri for ref in (c.sources or []) if ref.uri}
            merged = list(c.sources or [])
            for ref in sourcing_picks:
                if ref.uri and ref.uri not in already:
                    merged.append(ref)
                    already.add(ref.uri)
            c.sources = merged

    await progress({
        "phase": "done",
        "message": (
            f"{len(candidates)} candidat(s) prêt(s)"
            if candidates
            else "Aucun candidat trouvé."
        ),
        "count": len(candidates),
    })

    return GenerateEntreprisesResponse(
        candidates=candidates,
        search_queries=queries,
        grounding=[GroundingRef(title=s.title, uri=s.uri) for s in sources[:8]],
    )


# ---------------------------------------------------------------------------
# API gouv enrichment + merge
# ---------------------------------------------------------------------------


# Default per-field source for any field not explicitly overridden during
# merge — Gemini is what populated the bare candidate.
_DEFAULT_GEMINI_FIELDS = (
    "entreprise", "site_web", "secteur", "adresse", "code_postal", "ville",
    "taille", "linkedin",
)

# (ApiGouvEnrichment attr, ProposedEntreprise attr) — straight 1:1 mappings
# overwritten when the API gouv value is present. Fields with custom merge
# rules (secteur/taille fallback, entreprise rename, dirigeants) are handled
# separately.
_API_GOUV_FIELD_MAP: tuple[tuple[str, str], ...] = (
    ("siret", "siret"),
    ("siren", "siren"),
    ("naf_code", "naf_code"),
    ("naf_label", "naf_label"),
    ("effectif", "effectif"),
    ("date_creation", "date_creation"),
    ("adresse", "adresse"),
    ("code_postal", "code_postal"),
    ("ville", "ville"),
)

async def _enrich_candidate(
    candidate: ProposedEntreprise,
    finess_by_name: dict | None,
    segment=None,
    sourcing_instruction: str = "",
    db: AsyncSession | None = None,
) -> ProposedEntreprise:
    """Merge API gouv (and optionally FINESS / Ordre) onto a Gemini candidate.

    Priority (per field):
      1. FINESS — when ``finess_by_name`` is provided and matches by name.
         Authoritative for identity fields (entreprise, siret, adresse, ville,
         code_postal, naf_code, naf_label) — never for ``dirigeants``.
      2. API gouv — authoritative for siret/siren, naf, effectif,
         date_creation, adresse, code_postal, ville, dirigeants.
      3. Gemini — kept for site_web, linkedin, secteur (if no naf_label),
         taille (if no INSEE effectif), and the qualitative ``raison``.

    Contact resolution :
      - If ``segment.data_sources`` contains ``"ordre_pharmaciens"``, the
        local Ordre annuaire is queried first. Matches return titulaire +
        adjoints with ``source="ordre"`` and Gemini is **skipped**
        (huge latency + cost win).
      - Otherwise (or on Ordre miss), the segment-driven Gemini chained
        agents fetch contacts via Google grounded search.
    """
    enriched = candidate.model_copy(deep=True)
    field_sources: dict[str, str] = {
        f: "gemini" for f in _DEFAULT_GEMINI_FIELDS
        if getattr(enriched, f, "")
    }

    # api_gouv + Google Places run as background tasks immediately so they
    # progress while we do the synchronous Ordre lookup. ``ensure_future``
    # converts the coroutine into a running Task without awaiting.
    api_task = asyncio.ensure_future(api_entreprise.enrich(
        name=enriched.entreprise,
        ville=enriched.ville or None,
        code_postal=enriched.code_postal or None,
    ))
    places_task = asyncio.ensure_future(google_places.enrich(
        name=enriched.entreprise,
        ville=enriched.ville or "",
        code_postal=enriched.code_postal or "",
        adresse=enriched.adresse or "",
    ))

    # Local Ordre lookup short-circuits the Gemini supplemental call entirely
    # when it finds a match. Cheap (one DB query), so we try it first.
    ordre_enabled = (
        db is not None
        and segment is not None
        and "ordre_pharmaciens" in (getattr(segment, "data_sources", None) or [])
    )
    ordre_contacts: list[dict[str, str]] = []
    if ordre_enabled:
        try:
            ordre_contacts = await lookup_pharmaciens(
                db,
                entreprise=enriched.entreprise,
                code_postal=enriched.code_postal or "",
                ville=enriched.ville or "",
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ordre_lookup failed for %r", enriched.entreprise
            )

    enrichment_sources: list[GroundingRef] = []
    if ordre_contacts:
        # Skip the Gemini chained-agent call — Ordre already gave us truth.
        api_result, places_result = await asyncio.gather(
            api_task, places_task, return_exceptions=True,
        )
        supplemental_contacts: list[dict[str, str]] = ordre_contacts
    else:
        # No Ordre match: fall back to segment-driven Gemini chained agents,
        # in parallel with the two HTTP enrichments already in flight.
        # ``adresse`` helps disambiguate same-name entreprises in the same city
        # — best effort, may be empty when api_gouv/FINESS haven't filled it yet.
        supplemental_task = fetch_supplemental_contacts(
            enriched.entreprise,
            ville=enriched.ville or "",
            code_postal=enriched.code_postal or "",
            adresse=enriched.adresse or "",
            segment=segment,
            sourcing_instruction=sourcing_instruction,
        )
        api_result, places_result, supplemental_result = await asyncio.gather(
            api_task,
            places_task,
            supplemental_task,
            return_exceptions=True,
        )
        if isinstance(supplemental_result, BaseException):
            supplemental_contacts = []
        else:
            supplemental_contacts, supp_sources = supplemental_result
            # Carry the contact-search agent's grounding URIs into the
            # candidate's `sources` field so the user can audit the URLs
            # the enrichment pipeline actually visited.
            enrichment_sources = [
                GroundingRef(title=s.title, uri=s.uri)
                for s in supp_sources
                if getattr(s, "uri", "")
            ]

    api_data: ApiGouvEnrichment | None = (
        api_result if not isinstance(api_result, BaseException) else None
    )
    places_data: GooglePlacesEnrichment | None = (
        places_result if not isinstance(places_result, BaseException) else None
    )

    if api_data is not None:
        for api_field, ent_field in _API_GOUV_FIELD_MAP:
            value = getattr(api_data, api_field)
            if not value:
                continue
            setattr(enriched, ent_field, value)
            field_sources[ent_field] = "api_gouv"
        if api_data.naf_label and not candidate.secteur:
            enriched.secteur = api_data.naf_label
            field_sources["secteur"] = "api_gouv"
        if api_data.effectif and not candidate.taille:
            enriched.taille = api_data.effectif
            field_sources["taille"] = "api_gouv"
        if api_data.nom_complet:
            enriched.entreprise = api_data.nom_complet
            field_sources["entreprise"] = "api_gouv"
        if api_data.dirigeants:
            enriched.dirigeants = [
                DirigeantSchema(nom=d.nom, qualite=d.qualite)
                for d in api_data.dirigeants
            ]
            field_sources["dirigeants"] = "api_gouv"
            enriched.contacts = [
                ProposedContact(nom=d.nom, role=d.qualite, source="api_gouv")
                for d in api_data.dirigeants
                if d.nom
            ][:MAX_CONTACTS_PER_CANDIDATE]

    # --- Google Places enrichment (phone, hours, GPS, rating, reviews) -----
    # Soft fields only — never overrides api_gouv on identity (siret, naf…),
    # but fills the contact / reputation gap that api_gouv doesn't cover.
    if places_data is not None:
        if places_data.telephone:
            enriched.telephone = places_data.telephone
            field_sources["telephone"] = "google_places"
        if places_data.place_id:
            enriched.google_place_id = places_data.place_id
            field_sources["google_place_id"] = "google_places"
        if places_data.google_maps_url:
            enriched.google_maps_url = places_data.google_maps_url
            field_sources["google_maps_url"] = "google_places"
        if places_data.rating is not None:
            enriched.google_rating = places_data.rating
            field_sources["google_rating"] = "google_places"
        if places_data.rating_count is not None:
            enriched.google_rating_count = places_data.rating_count
            field_sources["google_rating_count"] = "google_places"
        if places_data.latitude is not None:
            enriched.latitude = places_data.latitude
            field_sources["latitude"] = "google_places"
        if places_data.longitude is not None:
            enriched.longitude = places_data.longitude
            field_sources["longitude"] = "google_places"
        # site_web : Places' URL is canonical when Gemini didn't already give one.
        if places_data.site_web and not candidate.site_web:
            enriched.site_web = places_data.site_web
            field_sources["site_web"] = "google_places"
        # adresse : only fill if api_gouv didn't.
        if (
            places_data.adresse
            and field_sources.get("adresse") not in {"api_gouv", "finess"}
        ):
            enriched.adresse = places_data.adresse
            field_sources["adresse"] = "google_places"

    # Segment-driven supplemental contacts come first (they match the target
    # roles), then the RCS gérant from api_gouv. Dedupe by normalized name —
    # a supplemental contact who is also the gérant keeps its api_gouv entry.
    if supplemental_contacts:
        existing_names = {c.nom.strip().lower() for c in enriched.contacts}
        new_contacts = [
            ProposedContact(
                nom=t["nom"],
                role=t.get("role") or "",
                source=t.get("source") or "ai_grounding",
            )
            for t in supplemental_contacts
            if t.get("nom") and t["nom"].strip().lower() not in existing_names
        ]
        enriched.contacts = (new_contacts + list(enriched.contacts))[
            :MAX_CONTACTS_PER_CANDIDATE
        ]

    # --- 2. FINESS override on identity fields (if applicable) -------------
    if finess_by_name:
        key = _normalize_for_match(enriched.entreprise)
        finess_rec = finess_by_name.get(key) if key else None
        if finess_rec is not None:
            if finess_rec.rslongue or finess_rec.rs:
                enriched.entreprise = finess_rec.rslongue or finess_rec.rs
                field_sources["entreprise"] = "finess"
            if finess_rec.siret:
                enriched.siret = finess_rec.siret
                field_sources["siret"] = "finess"
            if finess_rec.adresse:
                enriched.adresse = finess_rec.adresse
                field_sources["adresse"] = "finess"
            if finess_rec.lib_categetab and not enriched.secteur:
                enriched.secteur = finess_rec.lib_categetab
                field_sources["secteur"] = "finess"

    # Carry the contact-search agent's visited URLs into enriched.sources.
    # Sourcing-time per-candidate attribution (`_attribute_sources`) runs
    # later in generate_entreprises and will merge its own picks alongside.
    if enrichment_sources:
        enriched.sources = list(enrichment_sources)

    enriched.field_sources = field_sources
    return enriched
