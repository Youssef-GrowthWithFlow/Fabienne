"""Async client for Google Places API (New, v1).

Used during sourcing to enrich each candidate with:

- **Basic contact data**: phone (international + national), GPS coords,
  formatted address.
- **Digital identity**: official website, Google Maps URL, Place ID.
- **Reputation**: average rating (0-5) + user ratings count.

Endpoints used:

- ``POST /places:searchText`` — text search by name + locality,
  returns up to N matches with a basic field mask.
- ``GET /places/{placeId}`` — full details with the wider field mask.

Field mask matters for billing: we ask only the fields we use, on the
"Atmosphere" tier (rating + reviews count) which is the most expensive.
Approx. cost per enrichment as of 2026: ~$0.02-0.03.

Empty ``GOOGLE_PLACES_API_KEY`` disables the service: ``enrich()`` returns
``None`` without making any HTTP call. Calling code keeps the existing
fields intact in that case.
"""
from __future__ import annotations

import asyncio
import logging
import unicodedata
from functools import lru_cache
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Normalized payload returned to the sourcer
# ---------------------------------------------------------------------------


class GooglePlacesEnrichment(BaseModel):
    """Subset of a Place resource we propagate to ``Entreprise``."""

    place_id: str = ""
    nom_canonique: str = ""
    adresse: str = ""
    telephone: str = ""
    site_web: str = ""
    google_maps_url: str = ""
    rating: float | None = None
    rating_count: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    types: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Field masks
# ---------------------------------------------------------------------------
#
# Field mask is REQUIRED by the Places API (v1). Smaller = cheaper.
# We split into two calls so the cheap text-search step doesn't pay for
# Atmosphere (rating/reviews) fields it can't return anyway.

_SEARCH_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
])

_DETAILS_FIELD_MASK = ",".join([
    "id",
    "displayName",
    "formattedAddress",
    "internationalPhoneNumber",
    "nationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "location",
    "types",
])


# ---------------------------------------------------------------------------
# HTTP plumbing (singleton client + concurrency cap)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _semaphore() -> asyncio.Semaphore:
    return asyncio.Semaphore(settings.GOOGLE_PLACES_MAX_CONCURRENCY)


@lru_cache(maxsize=1)
def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.GOOGLE_PLACES_BASE_URL,
        timeout=settings.GOOGLE_PLACES_TIMEOUT,
        headers={
            "User-Agent": "Fabienne/1.0 (+sourcing-agent)",
        },
    )


async def aclose() -> None:
    """Best-effort close of the singleton client."""
    try:
        await _client().aclose()
        _client.cache_clear()
    except Exception:  # pragma: no cover
        logger.exception("google_places client close failed")


def _enabled() -> bool:
    return bool(settings.GOOGLE_PLACES_API_KEY)


async def _post(path: str, body: dict, *, field_mask: str) -> dict | None:
    sem = _semaphore()
    client = _client()
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }
    for attempt in range(2):
        async with sem:
            try:
                resp = await client.post(path, json=body, headers=headers)
            except httpx.HTTPError as exc:
                logger.warning("google_places POST %s network error: %s", path, exc)
                if attempt == 0:
                    await asyncio.sleep(0.8)
                    continue
                return None
        if resp.status_code == 200:
            try:
                return resp.json()
            except ValueError:
                logger.warning("google_places non-JSON on POST %s", path)
                return None
        if resp.status_code in (429, 500, 502, 503, 504) and attempt == 0:
            await asyncio.sleep(0.8)
            continue
        logger.info(
            "google_places POST %s → HTTP %d body=%r",
            path, resp.status_code, resp.text[:200],
        )
        return None
    return None


async def _get(path: str, *, field_mask: str) -> dict | None:
    sem = _semaphore()
    client = _client()
    headers = {
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }
    for attempt in range(2):
        async with sem:
            try:
                resp = await client.get(path, headers=headers)
            except httpx.HTTPError as exc:
                logger.warning("google_places GET %s network error: %s", path, exc)
                if attempt == 0:
                    await asyncio.sleep(0.8)
                    continue
                return None
        if resp.status_code == 200:
            try:
                return resp.json()
            except ValueError:
                return None
        if resp.status_code in (429, 500, 502, 503, 504) and attempt == 0:
            await asyncio.sleep(0.8)
            continue
        logger.info(
            "google_places GET %s → HTTP %d body=%r",
            path, resp.status_code, resp.text[:200],
        )
        return None
    return None


# ---------------------------------------------------------------------------
# Matching helpers (lightweight — we trust Places' relevance ranking)
# ---------------------------------------------------------------------------


def _strip_accents(s: str) -> str:
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )


def _build_text_query(name: str, ville: str, code_postal: str) -> str:
    parts = [name.strip()]
    if code_postal:
        parts.append(code_postal.strip())
    elif ville:
        parts.append(ville.strip())
    return " ".join(p for p in parts if p)


def _to_enrichment(detail: dict[str, Any]) -> GooglePlacesEnrichment:
    name = (detail.get("displayName") or {}).get("text") or ""
    location = detail.get("location") or {}
    return GooglePlacesEnrichment(
        place_id=detail.get("id") or "",
        nom_canonique=name,
        adresse=detail.get("formattedAddress") or "",
        telephone=(
            detail.get("internationalPhoneNumber")
            or detail.get("nationalPhoneNumber")
            or ""
        ),
        site_web=detail.get("websiteUri") or "",
        google_maps_url=detail.get("googleMapsUri") or "",
        rating=detail.get("rating"),
        rating_count=detail.get("userRatingCount"),
        latitude=location.get("latitude"),
        longitude=location.get("longitude"),
        types=list(detail.get("types") or []),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def enrich(
    name: str,
    ville: str = "",
    code_postal: str = "",
    adresse: str = "",
) -> GooglePlacesEnrichment | None:
    """Look up the entreprise on Google Places and return enrichment data.

    Returns ``None`` when:
      - the API key is unset (service disabled),
      - the text search returns no result above a basic relevance bar,
      - any network/API error (soft-fail — the sourcer keeps existing values).
    """
    if not _enabled() or not name.strip():
        return None

    # Build a text query that includes a locality cue when available — this
    # is what makes the match selective enough to avoid wrong-city hits.
    query = _build_text_query(name, ville=ville, code_postal=code_postal)

    # Step 1: text search (cheap field mask).
    search = await _post(
        "/places:searchText",
        body={
            "textQuery": query,
            "languageCode": "fr",
            "regionCode": "FR",
            "maxResultCount": 5,
        },
        field_mask=_SEARCH_FIELD_MASK,
    )
    if not search:
        return None
    places = search.get("places") or []
    if not places:
        logger.info("google_places: no result for %r", query)
        return None

    # Pick the first candidate whose formatted address mentions the city or CP
    # (Places already ranks by relevance; we just filter out obvious wrong-city
    # matches when we have the locality info).
    target_city = _strip_accents(ville).lower().strip()
    target_cp = code_postal.strip()
    picked: dict[str, Any] | None = None
    for cand in places:
        addr = _strip_accents(cand.get("formattedAddress") or "").lower()
        if target_cp and target_cp in addr:
            picked = cand
            break
        if target_city and target_city in addr:
            picked = cand
            break
    if picked is None:
        picked = places[0]

    place_id = picked.get("id")
    if not place_id:
        return None

    # Step 2: full details (atmosphere field mask).
    detail = await _get(f"/places/{place_id}", field_mask=_DETAILS_FIELD_MASK)
    if not detail:
        return None

    enrichment = _to_enrichment(detail)
    logger.info(
        "google_places: %r → %r (rating=%s, reviews=%s)",
        query, enrichment.nom_canonique,
        enrichment.rating, enrichment.rating_count,
    )
    return enrichment
