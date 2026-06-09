"""Async client for the DropContact API (B2B contact enrichment).

Used at candidate validation to enrich a prospect's contact identity (email,
phone, LinkedIn, job title) given a ``(first_name, last_name, company)``
triple. DropContact validates emails in addition to discovering them, so
the returned email comes with a ``qualification`` flag we propagate.

API shape (async): POST submits a batch and returns a ``request_id``; GET
polls that id until the result is ready (typically 20–60 s). We expose a
single ``enrich()`` helper that does the round-trip with a bounded poll
window — soft-failing to ``None`` when:

- the API key is unset (service disabled);
- the request_id never produces a ready result before timeout;
- any HTTP error along the way.

Calling code keeps existing prospect values intact on a soft failure.
"""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache

import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Normalized payload returned to callers
# ---------------------------------------------------------------------------


class DropContactEnrichment(BaseModel):
    """Subset of a DropContact result row we propagate to a Prospect."""

    civility: str = ""
    first_name: str = ""
    last_name: str = ""
    full_name: str = ""
    email: str = ""
    email_qualification: str = ""
    """One of ``"nominative@pro"`` (verified personal), ``"generic@pro"``
    (info@, contact@ — catch-all), ``"invalid"`` (do not send).
    Empty when no email was found at all."""
    phone: str = ""
    mobile_phone: str = ""
    linkedin: str = ""
    job: str = ""


# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.DROPCONTACT_BASE_URL,
        timeout=settings.DROPCONTACT_TIMEOUT,
        headers={"User-Agent": "Fabienne/1.0 (+sourcing-agent)"},
    )


def _enabled() -> bool:
    return bool(settings.DROPCONTACT_API_KEY)


# ---------------------------------------------------------------------------
# Split helper — DropContact wants ``first_name`` + ``last_name``, our schema
# carries a single ``nom`` field. Heuristic: first token is first name, rest
# is last name. Names with particles (de, du, le, van…) keep the particle on
# the last name side. Soft-fails to (nom, "") when there's a single token.
# ---------------------------------------------------------------------------


_PARTICLES = {"de", "du", "le", "la", "van", "von", "der", "den", "el", "al"}


def split_full_name(nom: str) -> tuple[str, str]:
    nom = (nom or "").strip()
    if not nom:
        return "", ""
    parts = nom.split()
    if len(parts) == 1:
        return parts[0], ""
    # Walk forward until we hit either a known particle or the second-to-last
    # token; everything before is the prénom.
    first_idx = 0
    for i, tok in enumerate(parts[1:], start=1):
        if tok.lower() in _PARTICLES:
            first_idx = i
            break
        if i == len(parts) - 1:
            # Default: first token is prénom, rest is nom.
            first_idx = 1
            break
    first = " ".join(parts[:first_idx])
    last = " ".join(parts[first_idx:])
    return first.strip(), last.strip()


# ---------------------------------------------------------------------------
# API calls
# ---------------------------------------------------------------------------


async def _submit(
    first_name: str,
    last_name: str,
    company: str,
    website: str,
    linkedin: str,
) -> str | None:
    """POST a single-contact batch. Returns the request_id, or None on error."""
    payload = {
        "data": [
            {
                "first_name": first_name,
                "last_name": last_name,
                "company": company,
                "website": website,
                "linkedin": linkedin,
            }
        ],
        "siren": False,
        "language": "fr",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Access-Token": settings.DROPCONTACT_API_KEY,
    }
    client = _client()
    try:
        resp = await client.post(
            "/enrich/all", json=payload, headers=headers,
        )
    except httpx.HTTPError as exc:
        logger.warning("dropcontact submit network error: %s", exc)
        return None
    if resp.status_code != 200:
        logger.info(
            "dropcontact submit → HTTP %d body=%r",
            resp.status_code, resp.text[:200],
        )
        return None
    try:
        data = resp.json()
    except ValueError:
        logger.warning("dropcontact submit: non-JSON response")
        return None
    if data.get("error") is True or not data.get("success"):
        logger.info("dropcontact submit returned error payload: %r", data)
        return None
    rid = data.get("request_id")
    return rid if isinstance(rid, str) and rid else None


async def _poll(request_id: str) -> dict | None:
    """Poll GET /enrich/all/{request_id} until ready or until timeout.

    Returns the first ``data`` row when ready. ``None`` on timeout / error.
    """
    headers = {"X-Access-Token": settings.DROPCONTACT_API_KEY}
    client = _client()
    deadline = asyncio.get_event_loop().time() + settings.DROPCONTACT_POLL_TIMEOUT
    while True:
        try:
            resp = await client.get(
                f"/enrich/all/{request_id}", headers=headers,
            )
        except httpx.HTTPError as exc:
            logger.warning("dropcontact poll network error: %s", exc)
            return None
        if resp.status_code != 200:
            logger.info(
                "dropcontact poll %s → HTTP %d body=%r",
                request_id, resp.status_code, resp.text[:200],
            )
            return None
        try:
            data = resp.json()
        except ValueError:
            return None
        # "Request not ready yet" pattern: success=False, error=False.
        if data.get("success") is True and "data" in data:
            rows = data.get("data") or []
            return rows[0] if rows else None
        if asyncio.get_event_loop().time() >= deadline:
            logger.info(
                "dropcontact poll %s timed out after %.0fs",
                request_id, settings.DROPCONTACT_POLL_TIMEOUT,
            )
            return None
        await asyncio.sleep(settings.DROPCONTACT_POLL_INTERVAL)


def _to_enrichment(row: dict) -> DropContactEnrichment:
    # Email is returned as a list of {email, qualification} objects, ranked
    # by DropContact. Pick the first nominative@pro if any, else the first
    # entry; fall back to empty string if nothing usable.
    emails = row.get("email") or []
    if not isinstance(emails, list):
        emails = []
    best_email = ""
    best_qual = ""
    for entry in emails:
        if not isinstance(entry, dict):
            continue
        addr = (entry.get("email") or "").strip()
        qual = (entry.get("qualification") or "").strip()
        if not addr:
            continue
        if not best_email:
            best_email, best_qual = addr, qual
        if qual == "nominative@pro":
            best_email, best_qual = addr, qual
            break
    return DropContactEnrichment(
        civility=(row.get("civility") or "").strip(),
        first_name=(row.get("first_name") or "").strip(),
        last_name=(row.get("last_name") or "").strip(),
        full_name=(row.get("full_name") or "").strip(),
        email=best_email,
        email_qualification=best_qual,
        phone=(row.get("phone") or "").strip(),
        mobile_phone=(row.get("mobile_phone") or "").strip(),
        linkedin=(row.get("linkedin") or "").strip(),
        job=(row.get("job") or "").strip(),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def enrich(
    nom: str,
    entreprise: str,
    website: str = "",
    linkedin: str = "",
) -> DropContactEnrichment | None:
    """Enrich a contact by ``(nom, entreprise)`` via DropContact.

    Returns ``None`` on disabled service / soft failure. The contact's
    full name is split with :func:`split_full_name` (single-token names
    are still sent — DropContact may still find them via the company +
    LinkedIn hint).
    """
    if not _enabled():
        return None
    nom = (nom or "").strip()
    company = (entreprise or "").strip()
    if not nom or not company:
        return None
    first, last = split_full_name(nom)
    request_id = await _submit(
        first_name=first,
        last_name=last,
        company=company,
        website=(website or "").strip(),
        linkedin=(linkedin or "").strip(),
    )
    if not request_id:
        return None
    row = await _poll(request_id)
    if row is None:
        return None
    enrichment = _to_enrichment(row)
    logger.info(
        "dropcontact: %r @ %r → email=%r (qual=%r) job=%r",
        nom, company, enrichment.email, enrichment.email_qualification,
        enrichment.job,
    )
    return enrichment
