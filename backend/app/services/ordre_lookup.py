"""Local lookup of pharmaciens against the ingested Ordre des Pharmaciens annuaire.

Replaces the Gemini chained-agent contact lookup for segments where the user
opted in to ``data_sources: ['ordre_pharmaciens']``. Uses the three
``ordre_*`` tables fed by ``app.scripts.ingest_ordre``.

Match strategy:

1. Filter by **code postal** when available (most precise, the Ordre CSV
   has CPs on virtually every officine).
2. Fall back to **commune** ILIKE when CP is unknown.
3. Score candidate établissements by name similarity against the
   normalized ``raison_sociale + dénomination_commerciale`` index column.
4. Keep the best match above a threshold; tie-break by exact CP match.
5. Join activités + pharmaciens to return [{nom, role, source}] sorted
   titulaire → adjoint → other.

Returns ``[]`` on no match — caller should fall back to the Gemini chained
agents (already handled in ``sourcer._enrich_candidate``).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ordre import OrdreActivite, OrdreEtablissement, OrdrePharmacien
from app.services.api_entreprise import _LEGAL_FORMS, _normalize

logger = logging.getLogger(__name__)

# Minimum target-side containment to accept an établissement match.
# 0.7 = at least 70% of the candidate's significant tokens must appear
# in the etab's (raison sociale + dénomination commerciale).
_NAME_MATCH_THRESHOLD = 0.7

# Stopwords filtered before scoring so that "de", "la", etc. don't cause
# spurious matches between unrelated officines.
_FR_STOPWORDS = {
    "de", "du", "des", "la", "le", "les", "l", "a", "au", "aux",
    "et", "en", "sur", "sous", "dans", "par",
}


def _tokens_for_match(text: str) -> set[str]:
    """Tokenize for fuzzy matching: lower, strip accents, drop legal forms
    and common French stopwords. Single-letter tokens are dropped too."""
    return {
        t for t in _normalize(text).split()
        if len(t) > 1 and t not in _LEGAL_FORMS and t not in _FR_STOPWORDS
    }

# Function-priority for ordering returned contacts. Lower = higher priority.
# Anything not in the table gets a high default (sorted to the end).
_FONCTION_PRIORITY: dict[str, int] = {
    "PHARMACIEN TITULAIRE D'OFFICINE": 0,
    "PHARMACIEN TITULAIRE D OFFICINE": 0,
    "GERANT APRES DECES": 1,
    "PHARMACIEN ADJOINT D'OFFICINE": 2,
    "PHARMACIEN ADJOINT D OFFICINE": 2,
    "ADJOINT D'OFFICINE TEMPS PARTIEL": 3,
    "ADJOINT D OFFICINE TEMPS PARTIEL": 3,
    "PHARMACIEN REMPLACANT": 4,
}


def _fonction_priority(fonction: str) -> int:
    norm = fonction.strip().upper()
    return _FONCTION_PRIORITY.get(norm, 99)


def _humanize_fonction(fonction: str) -> str:
    """Turn ``PHARMACIEN TITULAIRE D'OFFICINE`` into ``Pharmacien titulaire d'officine``."""
    return fonction.strip().capitalize()


def _humanize_name(prenom: str, nom: str) -> str:
    """``VINCENT BARTHE`` → ``Vincent Barthe``."""
    def _cap(token: str) -> str:
        if not token:
            return token
        # Handle compound names with hyphens / apostrophes.
        out = []
        for sep in ("-", "'"):
            if sep in token:
                parts = token.split(sep)
                return sep.join(_cap(p) for p in parts)
        return token[:1].upper() + token[1:].lower()

    full = f"{prenom} {nom}".strip()
    return " ".join(_cap(t) for t in full.split())


@dataclass
class _EtabCandidate:
    etab: OrdreEtablissement
    score: float


def _score_etab(etab: OrdreEtablissement, target_tokens: set[str]) -> float:
    """Containment ratio: fraction of target's significant tokens found in etab.

    Asymmetric on purpose — the etab is allowed to carry extra tokens
    (typical when ``dénomination_commerciale`` adds words to the legal
    ``raison_sociale``). Jaccard would over-penalize that.
    """
    if not target_tokens:
        return 0.0
    etab_tokens = _tokens_for_match(
        f"{etab.raison_sociale} {etab.denomination_commerciale}"
    )
    if not etab_tokens:
        return 0.0
    inter = len(etab_tokens & target_tokens)
    return inter / len(target_tokens)


async def _find_best_etab(
    db: AsyncSession,
    entreprise: str,
    code_postal: str,
    ville: str,
    type_filter: str | None = "OFFICINE",
) -> OrdreEtablissement | None:
    target_tokens = _tokens_for_match(entreprise)
    if not target_tokens:
        return None

    # 1. First pass: filter by CP (cheap, very selective).
    stmt = select(OrdreEtablissement)
    if type_filter:
        stmt = stmt.where(OrdreEtablissement.type_etablissement == type_filter)

    cp = (code_postal or "").strip()
    if cp:
        stmt = stmt.where(OrdreEtablissement.code_postal == cp)
    elif ville:
        # Fall back to commune ILIKE — slightly broader but still selective.
        stmt = stmt.where(OrdreEtablissement.commune.ilike(f"%{ville.strip()}%"))
    else:
        # No location filter at all — restrict by name keywords via the
        # normalized index (cheap LIKE on the longest token).
        longest = max(target_tokens, key=len)
        stmt = stmt.where(
            OrdreEtablissement.nom_normalise.ilike(f"%{longest}%")
        )

    res = await db.execute(stmt.limit(200))
    candidates = list(res.scalars().all())
    if not candidates:
        return None

    scored = [
        _EtabCandidate(etab=e, score=_score_etab(e, target_tokens))
        for e in candidates
    ]
    scored.sort(key=lambda c: c.score, reverse=True)
    best = scored[0]
    if best.score < _NAME_MATCH_THRESHOLD:
        logger.info(
            "ordre_lookup: best match for %r in CP=%s scored %.2f (< %.2f) — "
            "rejecting (top: %r)",
            entreprise, cp, best.score, _NAME_MATCH_THRESHOLD,
            f"{best.etab.raison_sociale} / {best.etab.denomination_commerciale}",
        )
        return None
    return best.etab


async def lookup_pharmaciens(
    db: AsyncSession,
    entreprise: str,
    code_postal: str = "",
    ville: str = "",
    type_filter: str | None = "OFFICINE",
    limit: int = 3,
) -> list[dict[str, str]]:
    """Return up to ``limit`` contacts from the local Ordre annuaire.

    Each item: ``{nom, role, source: "ordre"}``. Sorted titulaire → adjoint →
    other. Returns ``[]`` if no établissement matches confidently — caller
    should fall back to the Gemini chained-agent lookup.
    """
    if not entreprise:
        return []

    etab = await _find_best_etab(
        db, entreprise=entreprise, code_postal=code_postal,
        ville=ville, type_filter=type_filter,
    )
    if etab is None:
        return []

    stmt = (
        select(OrdreActivite, OrdrePharmacien)
        .join(
            OrdrePharmacien,
            OrdrePharmacien.rpps == OrdreActivite.rpps,
        )
        .where(OrdreActivite.numero_etablissement == etab.numero_etablissement)
    )
    res = await db.execute(stmt)
    rows = list(res.all())

    rows.sort(key=lambda r: _fonction_priority(r[0].fonction))

    out: list[dict[str, str]] = []
    seen_rpps: set[str] = set()
    for act, pharm in rows:
        if act.rpps in seen_rpps:
            continue
        seen_rpps.add(act.rpps)
        if not (pharm.prenom or pharm.nom_exercice):
            continue
        out.append({
            "nom": _humanize_name(pharm.prenom, pharm.nom_exercice),
            "role": _humanize_fonction(act.fonction),
            "source": "ordre",
        })
        if len(out) >= limit:
            break

    logger.info(
        "ordre_lookup: %s → etab %s (%s), %d contact(s)",
        entreprise, etab.numero_etablissement[:8],
        etab.raison_sociale or etab.denomination_commerciale,
        len(out),
    )
    return out
