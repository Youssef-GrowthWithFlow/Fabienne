"""Shared Gemini helpers: client, response parsers, segment formatter.

Public surface used by enrichment, sourcer, and the chat dispatcher / agents.
"""
from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from typing import Any

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


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------

_JSON_FENCE_OBJECT = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)
_JSON_FENCE_ARRAY = re.compile(r"```(?:json)?\s*(\[.*?\])\s*```", re.DOTALL)


def _slice_balanced(text: str, open_ch: str, close_ch: str) -> str | None:
    """Return the first balanced `open_ch ... close_ch` slice, respecting strings."""
    start = text.find(open_ch)
    if start < 0:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
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
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def extract_json_object(text: str) -> Any:
    """Parse the first JSON object or array found in `text`.

    Tolerant to ```json fenced blocks, bare blocks, top-level arrays,
    nested arrays/objects within values.
    """
    if not text:
        return None

    candidates: list[str] = []
    m = _JSON_FENCE_OBJECT.search(text)
    if m:
        candidates.append(m.group(1))
    m = _JSON_FENCE_ARRAY.search(text)
    if m:
        candidates.append(m.group(1))

    obj_slice = _slice_balanced(text, "{", "}")
    if obj_slice:
        candidates.append(obj_slice)
    arr_slice = _slice_balanced(text, "[", "]")
    if arr_slice:
        candidates.append(arr_slice)

    for raw in candidates:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            continue

    logger.warning("Gemini response did not yield parseable JSON: %r", text[:600])
    return None


def extract_json(text: str) -> dict[str, str]:
    """Parse JSON and flatten all values to strings (legacy use)."""
    parsed = extract_json_object(text)
    if not isinstance(parsed, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in parsed.items():
        if isinstance(v, str):
            out[str(k)] = v.strip()
        elif isinstance(v, (int, float)):
            out[str(k)] = str(v)
        elif isinstance(v, list):
            out[str(k)] = ", ".join(str(x).strip() for x in v if str(x).strip())
        else:
            out[str(k)] = ""
    return out


# ---------------------------------------------------------------------------
# Grounding metadata
# ---------------------------------------------------------------------------


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
