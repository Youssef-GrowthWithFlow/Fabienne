"""Shared Gemini helpers: client, response parsers, segment formatter."""
from __future__ import annotations

import logging
from functools import lru_cache

from google import genai

from app.core.config import settings
from app.schemas.enrichment import GroundingSource

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Set it in the backend environment."
        )
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def extract_sources(response) -> tuple[list[GroundingSource], list[str]]:
    """Pull grounding chunks + web_search_queries off a generate_content response."""
    sources: list[GroundingSource] = []
    queries: list[str] = []
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return sources, queries
    meta = getattr(candidates[0], "grounding_metadata", None)
    if not meta:
        return sources, queries
    chunks = getattr(meta, "grounding_chunks", None) or []
    seen: set[str] = set()
    for chunk in chunks:
        web = getattr(chunk, "web", None)
        if web is None:
            continue
        uri = getattr(web, "uri", "") or ""
        title = getattr(web, "title", "") or getattr(web, "domain", "") or ""
        if not uri or uri in seen:
            continue
        seen.add(uri)
        sources.append(GroundingSource(title=title, uri=uri))
    raw_queries = getattr(meta, "web_search_queries", None) or []
    queries = [str(q) for q in raw_queries if q]
    return sources, queries


# ---------------------------------------------------------------------------
# Segment brief formatter (shared across prompts)
# ---------------------------------------------------------------------------


def format_segment_brief(segment, empty: str = "(brief segment indisponible)") -> str:
    if segment is None:
        return empty
    lines: list[str] = []
    if segment.nom:
        lines.append(f"Nom: {segment.nom}")
    if segment.description:
        lines.append(f"Description: {segment.description}")
    activite = getattr(segment, "activite_ciblee", None) or []
    if activite:
        lines.append(f"Activité ciblée: {', '.join(activite)}")
    zone = getattr(segment, "zone_geographique", None) or []
    if zone:
        lines.append(f"Zone géographique: {', '.join(zone)}")
    if segment.taille_structure:
        lines.append(f"Taille type: {segment.taille_structure}")
    if segment.postes:
        lines.append(f"Postes cibles: {', '.join(segment.postes)}")
    if segment.must_have:
        lines.append(f"Must-have: {', '.join(segment.must_have)}")
    if segment.should_have:
        lines.append(f"Should-have: {', '.join(segment.should_have)}")
    if segment.red_flags:
        lines.append(f"Red flags: {', '.join(segment.red_flags)}")
    if segment.pain_points:
        lines.append(f"Pain points: {', '.join(segment.pain_points)}")
    ai_sources = getattr(segment, "ai_sources", None) or []
    if ai_sources:
        lines.append(
            "Sources web suggérées par l'utilisateur "
            "(l'IA décide librement de s'en servir si pertinentes) :"
        )
        for src in ai_sources:
            url = (src.get("url") if isinstance(src, dict) else getattr(src, "url", "")) or ""
            desc = (src.get("description") if isinstance(src, dict) else getattr(src, "description", "")) or ""
            url = url.strip()
            desc = desc.strip()
            if not url and not desc:
                continue
            if url and desc:
                lines.append(f"- {url} — {desc}")
            else:
                lines.append(f"- {url or desc}")
    return "\n".join(lines) if lines else empty
