"""Async client for recherche-entreprises.api.gouv.fr (public, no auth).

Used during sourcing to enrich each Gemini-proposed candidate with structured,
authoritative identity data: SIRET/SIREN, NAF code+label, effectif (INSEE
tranche), date de création, normalized address, and the list of dirigeants
(used to pre-seed prospects with verified nom + qualité).

Rate limit (public tier): 7 req/s. We cap concurrency via a module-level
semaphore and retry once on 429/5xx with a short backoff. On a soft failure
(no match, network error) we return ``None`` so the caller can keep the
Gemini-suggested values.
"""
from __future__ import annotations

import asyncio
import logging
import re
import unicodedata
from datetime import date
from functools import lru_cache
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Normalized payload returned to the sourcer
# ---------------------------------------------------------------------------


class ApiGouvDirigeant(BaseModel):
    nom: str = ""
    qualite: str = ""


class ApiGouvEnrichment(BaseModel):
    """Authoritative subset extracted from a recherche-entreprises hit."""

    model_config = ConfigDict(populate_by_name=True)

    nom_complet: str = ""
    siren: str | None = None
    siret: str | None = None
    naf_code: str | None = None
    naf_label: str | None = None
    effectif: str | None = None
    date_creation: date | None = None
    adresse: str = ""
    code_postal: str = ""
    ville: str = ""
    dirigeants: list[ApiGouvDirigeant] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# HTTP client + rate limiting
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _semaphore() -> asyncio.Semaphore:
    return asyncio.Semaphore(settings.API_GOUV_MAX_CONCURRENCY)


@lru_cache(maxsize=1)
def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.API_GOUV_BASE_URL,
        timeout=settings.API_GOUV_TIMEOUT,
        headers={"User-Agent": "Fabienne/1.0 (+sourcing-agent)"},
    )


async def aclose() -> None:
    """Close the singleton client (call from app shutdown if desired)."""
    try:
        client = _client.cache_info()  # noqa: F841 — only to test populated state
    except Exception:  # pragma: no cover
        return
    try:
        await _client().aclose()
        _client.cache_clear()
    except Exception:  # pragma: no cover
        logger.exception("api_entreprise client close failed")


async def _request(path: str, params: dict[str, Any]) -> dict | None:
    """GET with retry on 429/5xx (1 retry, ~1s backoff)."""
    sem = _semaphore()
    client = _client()
    for attempt in range(2):
        async with sem:
            try:
                resp = await client.get(path, params=params)
            except httpx.HTTPError as exc:
                logger.warning(
                    "api_entreprise %s %r network error: %s",
                    path, params, exc,
                )
                if attempt == 0:
                    await asyncio.sleep(0.8)
                    continue
                return None
        if resp.status_code == 200:
            try:
                return resp.json()
            except ValueError:
                logger.warning("api_entreprise non-JSON response on %s", path)
                return None
        if resp.status_code in (429, 500, 502, 503, 504) and attempt == 0:
            await asyncio.sleep(0.8 + attempt * 0.6)
            continue
        logger.info(
            "api_entreprise %s %r → HTTP %d", path, params, resp.status_code
        )
        return None
    return None


# ---------------------------------------------------------------------------
# Matching heuristics
# ---------------------------------------------------------------------------


_PUNCT_RE = re.compile(r"[^\w\s]")


def _normalize(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return _PUNCT_RE.sub(" ", stripped).strip()


_LEGAL_FORMS = {
    "sas", "sarl", "sa", "eurl", "scop", "sci", "snc", "sasu",
    "selarl", "selas", "selasu", "sca", "gie", "sce",
}


def _token_set(text: str) -> set[str]:
    return {
        t for t in _normalize(text).split()
        if t and t not in _LEGAL_FORMS and len(t) > 1
    }


def _name_similarity(a: str, b: str) -> float:
    """Token-set Jaccard, ignoring legal forms (SAS, SARL…)."""
    ta, tb = _token_set(a), _token_set(b)
    if not ta or not tb:
        return 0.0
    inter = ta & tb
    union = ta | tb
    return len(inter) / len(union) if union else 0.0


def _pick_best_match(
    candidates: list[dict], name: str, ville: str | None
) -> dict | None:
    """Pick the highest-similarity candidate above the configured threshold.

    A matching ville (case/accent-insensitive) gives a small boost so two
    candidates with identical names disambiguate by location.
    """
    if not candidates:
        return None
    target_ville = _normalize(ville or "")
    threshold = settings.API_GOUV_MATCH_THRESHOLD
    best: tuple[float, dict] | None = None
    for c in candidates:
        nom = c.get("nom_complet") or c.get("nom_raison_sociale") or ""
        score = _name_similarity(name, nom)
        if target_ville:
            siege = c.get("siege") or {}
            cand_ville = _normalize(siege.get("libelle_commune") or "")
            if cand_ville and cand_ville == target_ville:
                score += 0.15
        if best is None or score > best[0]:
            best = (score, c)
    if best is None or best[0] < threshold:
        return None
    return best[1]


# ---------------------------------------------------------------------------
# Normalizer
# ---------------------------------------------------------------------------


def _opt_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        return s or None
    return str(value)


def _parse_date(value: Any) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _format_adresse(siege: dict) -> str:
    parts = [
        siege.get("numero_voie") or "",
        siege.get("type_voie") or "",
        siege.get("libelle_voie") or "",
    ]
    line = " ".join(p for p in parts if p).strip()
    if not line:
        # Some payloads expose a pre-formatted "adresse" string.
        return (siege.get("adresse") or "").strip()
    return line


def to_enrichment(payload: dict) -> ApiGouvEnrichment:
    siege = payload.get("siege") or {}
    dirigeants_raw = payload.get("dirigeants") or []
    dirigeants: list[ApiGouvDirigeant] = []
    for d in dirigeants_raw:
        if not isinstance(d, dict):
            continue
        nom = (
            d.get("nom_complet")
            or " ".join(
                p for p in [d.get("prenoms"), d.get("nom")] if p
            ).strip()
            or d.get("denomination")
            or ""
        )
        qualite = d.get("qualite") or ""
        if not nom and not qualite:
            continue
        dirigeants.append(
            ApiGouvDirigeant(nom=nom.strip(), qualite=qualite.strip())
        )

    return ApiGouvEnrichment(
        nom_complet=(payload.get("nom_complet") or "").strip(),
        siren=_opt_str(payload.get("siren")),
        siret=_opt_str(siege.get("siret")),
        naf_code=_opt_str(payload.get("activite_principale")),
        naf_label=_opt_str(payload.get("libelle_activite_principale")),
        effectif=_opt_str(payload.get("tranche_effectif_salarie")),
        date_creation=_parse_date(payload.get("date_creation")),
        adresse=_format_adresse(siege),
        code_postal=(siege.get("code_postal") or "").strip(),
        ville=(siege.get("libelle_commune") or "").strip(),
        dirigeants=dirigeants,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def search(
    name: str,
    ville: str | None = None,
    code_postal: str | None = None,
    per_page: int = 5,
) -> list[dict]:
    if not name or not name.strip():
        return []
    params: dict[str, Any] = {"q": name.strip(), "per_page": per_page, "page": 1}
    if code_postal:
        params["code_postal"] = code_postal
    payload = await _request("/search", params)
    if not payload:
        return []
    results = payload.get("results") or []
    return results if isinstance(results, list) else []


async def get_by_siret(siret: str) -> dict | None:
    siret = (siret or "").strip()
    if not siret:
        return None
    results = await search(siret, per_page=1)
    return results[0] if results else None


async def enrich(
    name: str,
    ville: str | None = None,
    code_postal: str | None = None,
) -> ApiGouvEnrichment | None:
    """Top-level helper: search → pick best match → normalize.

    Returns ``None`` on no match (below threshold) or any soft failure —
    caller must fall back to the original (Gemini) values.
    """
    try:
        results = await search(name, ville=ville, code_postal=code_postal)
    except Exception:  # noqa: BLE001
        logger.exception("api_entreprise.enrich failed for %r", name)
        return None
    match = _pick_best_match(results, name, ville)
    if match is None:
        return None
    try:
        return to_enrichment(match)
    except Exception:  # noqa: BLE001
        logger.exception("api_entreprise.to_enrichment failed for %r", name)
        return None
