"""Fiche generation + supplemental contact lookup, both Gemini-grounded.

Behavior is fully driven by the active `Segment` (target roles, sub-sector,
user-suggested AI sources) plus the free-form sourcing instruction passed at
call time. No hardcoded vertical logic.

Shared Gemini plumbing (client, JSON parsing, grounding extraction, segment
brief formatting) lives in `app.services.gemini`.
"""
from __future__ import annotations

import html as html_lib
import logging
import re
from urllib.parse import urlparse

from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.schemas.enrichment import GroundingSource
from app.services.gemini import (
    extract_sources,
    format_segment_brief,
    get_client,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Fiche generation
# ---------------------------------------------------------------------------


FICHE_SYSTEM_INSTRUCTION = """\
Tu es un assistant de recherche commerciale BtoB pour une équipe française. \
Ta mission : rédiger une **fiche entreprise** dense, factuelle et actionnable \
sur une entreprise donnée, en exploitant systématiquement la recherche Google \
avant d'écrire.

Tu reçois :
- l'entreprise cible (nom, site, ville, secteur, taille, dirigeants connus),
- le contact ou le rôle ciblé pour aiguiller la lecture (sans en faire le sujet de la fiche),
- le brief du segment commercial (must-have, should-have, red-flags, pain-points, postes cibles).

**Tu DOIS effectuer 3 à 6 recherches Google ciblées avant de répondre** : \
nom exact + ville, dirigeants nommés, actualité 12-24 derniers mois (levées, \
reprises, recrutements, transferts, ouvertures), enseigne / réseau / écosystème, \
chiffres publics (CA, effectif). Toute affirmation factuelle doit provenir des \
résultats de ces recherches.

Structure obligatoire de la fiche (HTML, exactement ces 5 sections h2 dans cet \
ordre, **pas de h3**) :

<h2>Identité</h2>
<p>3 à 5 phrases qui répondent : qui c'est, ce qu'elle fait concrètement, où elle opère, sa taille apparente (effectif, CA), son histoire récente si pertinent (date de création, reprise, transformation, étapes-clés). Cite SIRET / forme juridique si disponibles. Texte continu, dense, sans liste.</p>

<h2>Activité & positionnement</h2>
<p>1 à 2 paragraphes : modèle économique (B2B / B2C, mode de revenus), clients-types nommés, périmètre géographique, et **ce qui la distingue** — expertise technique, marques / produits / brevets, technologies clés, partenariats stratégiques nommés, certifications, écosystème, prix ou distinctions reçues. Chiffres et noms propres systématiquement.</p>

<h2>Signaux récents</h2>
<ul>
  <li>3 à 6 puces datées et sourcées. Privilégie les 12-24 derniers mois : levées de fonds (montant + date + investisseur), reprises / changements de capital, recrutements actifs (postes + volume), transferts / ouvertures de site, partenariats nouveaux, certifications obtenues, prix ou distinctions, contrats publics gagnés. Chaque puce = un fait vérifiable + sa source publique (Pappers, Maddyness, JOUE, registre, presse locale, site officiel…).</li>
</ul>

<h2>Décideurs</h2>
<ul>
  <li>Si tu identifies des dirigeants / décideurs nommés publiquement : 1 puce par personne, format « <strong>Prénom Nom</strong> — rôle (ex. Président, DAF, Directeur des opérations) ». Cite la source en fin de puce (Pappers, LinkedIn officiel de l'entreprise, communiqué).</li>
  <li>Si aucun décideur n'est trouvable, écris une seule puce : « Profil-type à viser : <em>[rôle adapté au segment]</em> (aucun dirigeant nommé identifié publiquement). »</li>
</ul>

<h2>Angle commercial</h2>
<p>2 à 3 phrases concrètes : <strong>pourquoi cette entreprise matche le segment</strong> (relie 1-2 signaux récents aux pain-points du brief) et <strong>sur quoi ouvrir le contact</strong> — un signal précis, un sujet d'actualité, un événement nommé. Si aucun angle n'émerge, dis-le explicitement (« Pas d'angle d'entrée évident à ce stade. »).</p>

Règles strictes :
1. **HTML uniquement**, exactement ces balises : <h2>, <p>, <ul>, <li>, <strong>, <em>. \
   PAS de <h3>, PAS de markdown, PAS de bloc de code, PAS de <html> / <body> / <doctype>.
2. **Aucune hallucination**. Si une info n'est pas trouvée par la recherche, ne l'écris pas. \
   Mieux vaut une fiche plus courte et juste qu'une fiche longue et inventée. Pas de \
   généralités creuses pour combler le vide.
3. **Densité factuelle** : chiffres datés, noms propres, montants, sources publiques nommées. \
   Si le brief segment fournit des sources web suggérées, considère-les en priorité. Ne \
   mets pas de section « Sources » toi-même — elle sera ajoutée automatiquement.
4. Style : précis, factuel, actionnable. Pas de méta-commentaires (« je ne sais pas », \
   « selon mes recherches », « il semble que »).
5. Français, ton professionnel.
6. Réponds **uniquement** par le HTML structuré. Pas de préambule, pas de conclusion, \
   pas de balises ```.\
"""


def _format_entreprise_signaux(entreprise) -> str:
    parts = []
    signaux = getattr(entreprise, "signaux", None) or []
    if signaux:
        parts.append("Signaux: " + ", ".join(str(s) for s in signaux if s))
    if getattr(entreprise, "score", ""):
        parts.append(f"Score: {entreprise.score}")
    if getattr(entreprise, "note", ""):
        parts.append(f"Note précédente: {entreprise.note}")
    return "\n".join(parts) if parts else "(aucun signal pré-détecté)"


def _build_fiche_message_from_entreprise(
    entreprise, contact_nom: str, contact_role: str, segment
) -> str:
    parts = [f"Entreprise: {entreprise.entreprise}"]
    # Contact / rôle servent juste à éclairer les sections "Décideurs" et
    # "Angle commercial" — le sujet de la fiche reste l'entreprise.
    if contact_nom:
        line = f"Contact identifié dans l'entreprise: {contact_nom}"
        if contact_role:
            line += f" ({contact_role})"
        parts.append(line)
    elif contact_role:
        parts.append(f"Rôle cible pour le segment: {contact_role}")
    if entreprise.site_web:
        parts.append(f"Site web connu: {entreprise.site_web}")
    if entreprise.ville:
        parts.append(f"Ville: {entreprise.ville}")
    if entreprise.secteur:
        parts.append(f"Secteur déclaré: {entreprise.secteur}")
    if entreprise.taille:
        parts.append(f"Taille déclarée: {entreprise.taille}")
    if getattr(entreprise, "siret", None):
        parts.append(f"SIRET: {entreprise.siret}")
    parts.append("")
    parts.append("Signaux pré-détectés :")
    parts.append(_format_entreprise_signaux(entreprise))
    parts.append("")
    parts.append("Brief du segment commercial cible :")
    parts.append(format_segment_brief(segment))
    parts.append("")
    parts.append(
        "AVANT de rédiger, lance 3 à 6 recherches Google ciblées sur cette "
        "entreprise (nom + ville, dirigeants nommés, actualité 12-24 derniers "
        "mois, écosystème, chiffres publics). Tes affirmations factuelles "
        "doivent toutes provenir de ces recherches — pas de tes connaissances "
        "pré-entraînées. Génère ensuite la **fiche entreprise** HTML selon les "
        "5 sections imposées (Identité, Activité & positionnement, Signaux "
        "récents, Décideurs, Angle commercial)."
    )
    return "\n".join(parts)


_HTML_FENCE = re.compile(r"^\s*```(?:html)?\s*|\s*```\s*$", re.IGNORECASE)


def _clean_fiche_html(raw: str) -> str:
    if not raw:
        return ""
    cleaned = _HTML_FENCE.sub("", raw).strip()
    cleaned = re.sub(
        r"^\s*<!doctype[^>]*>\s*", "", cleaned, flags=re.IGNORECASE
    )
    cleaned = re.sub(
        r"</?(?:html|body|head)[^>]*>", "", cleaned, flags=re.IGNORECASE
    )
    return cleaned.strip()




def _format_sources_section(
    sources: list[GroundingSource], queries: list[str]
) -> str:
    parts: list[str] = []
    if sources:
        items: list[str] = []
        for s in sources:
            href = (s.uri or "").strip()
            if not href:
                continue
            label = (s.title or "").strip() or href
            items.append(
                f'  <li><a href="{html_lib.escape(href, quote=True)}" '
                f'target="_blank" rel="noreferrer">{html_lib.escape(label)}</a></li>'
            )
        if items:
            parts.append("<h3>Pages citées</h3>")
            parts.append("<ul>\n" + "\n".join(items) + "\n</ul>")
    if queries:
        qitems = [
            f"  <li>{html_lib.escape(q)}</li>" for q in queries if q
        ]
        if qitems:
            parts.append("<h3>Recherches effectuées</h3>")
            parts.append("<ul>\n" + "\n".join(qitems) + "\n</ul>")
    if not parts:
        return ""
    return "<h2>Sources</h2>\n" + "\n".join(parts)


FORCE_GROUNDING_SUFFIX = (
    "\n\n**IMPÉRATIF — grounding obligatoire** : tu n'as PAS le droit de t'appuyer "
    "sur tes connaissances pré-entraînées seules. Lance d'abord au minimum 3 recherches "
    "Google ciblées sur cette entreprise (nom + ville, dirigeants, actualité récente). "
    "Toutes les affirmations factuelles de la fiche (montants, dates, effectifs, clients, "
    "partenaires, statuts juridiques) DOIVENT provenir des résultats actuels de ces "
    "recherches. Si tu ne trouves rien de fiable sur un point, ne l'écris pas."
)


async def _generate_fiche_html(
    user_message: str,
) -> tuple[str, list[GroundingSource], list[str]]:
    """Single Gemini call for fiche generation. Returns (html, sources, queries)."""
    client = get_client()
    config = types.GenerateContentConfig(
        system_instruction=FICHE_SYSTEM_INSTRUCTION,
        temperature=0.3,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        # Gemini 3.x: medium deliberation is enough to trigger 3-6 Google
        # searches and produce a grounded fiche. (legacy: thinking_budget=-1)
        thinking_config=types.ThinkingConfig(thinking_level="medium"),
    )

    async def _call(msg: str):
        return await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=msg,
            config=config,
        )

    response = await _call(user_message)
    sources, queries = extract_sources(response)

    if not sources and not queries:
        logger.warning(
            "Fiche call returned no grounding metadata; retrying with hard grounding suffix."
        )
        response = await _call(user_message + FORCE_GROUNDING_SUFFIX)
        sources, queries = extract_sources(response)
        if not sources and not queries:
            raise RuntimeError(
                "Le modèle n'a effectué aucune recherche Google : impossible "
                "de générer une fiche grounded. Réessaye dans un instant."
            )

    raw = getattr(response, "text", "") or ""
    html = _clean_fiche_html(raw)
    sources_html = _format_sources_section(sources, queries)
    if html and sources_html:
        html = html.rstrip() + "\n\n" + sources_html
    return html, sources, queries


async def build_entreprise_fiche(
    entreprise,
    segment,
    contact_nom: str = "",
    contact_role: str = "",
) -> tuple[str, list[GroundingSource], list[str]]:
    """Generate the HTML fiche_client for an entreprise.

    Called both at candidate validation (with the user-picked main contact's
    nom + role for the "Décideur à viser" section) and on manual regeneration
    (no contact — the role is derived from ``segment.postes`` if any).
    """
    if not contact_role and segment is not None:
        postes = list(getattr(segment, "postes", None) or [])
        if postes:
            contact_role = postes[0]
    user_message = _build_fiche_message_from_entreprise(
        entreprise, contact_nom, contact_role, segment
    )
    return await _generate_fiche_html(user_message)


# ---------------------------------------------------------------------------
# Supplemental contact lookup — fully segment-driven, chained agents
# ---------------------------------------------------------------------------
#
# Why this exists: ``recherche-entreprises.api.gouv.fr`` returns RCS représentants
# légaux only (typically the company's legal rep), which is often not the right
# person for BtoB prospection. Each Segment can declare the roles it targets
# (`postes`) and a list of suggested web sources the AI may probe
# (`ai_sources`). The free-form `sourcing_instruction` further refines or
# overrides at call time. The AI agent decides — no hardcoded domain or filter.
#
# Chained-agent design (one call can't be both grounded AND schema-bound: the
# Gemini API drops `grounding_chunks` when `response_mime_type=application/json`
# is set alongside `google_search` — same trade-off documented in `sourcer.py`).
#
#   Agent 1 (chercheur) : google_search ON, thinking ON, prose libre with
#                         URL citations in-line. We keep grounding_chunks.
#   Agent 2 (extracteur): no tools, response_schema = _SupplementalContacts.
#                         Guaranteed JSON shape.
#
# After both, we cross-reference each extracted `citation` against:
#   - the URIs of grounding_chunks returned by Agent 1, and
#   - the domains of `segment.ai_sources`,
# and tag verified contacts with `source = "ai_grounding_verified"`.


class _SupplementalContact(BaseModel):
    nom: str = Field(description="PRÉNOM NOM complet, sans titre civil.")
    role: str = Field(
        default="", description="Rôle exact dans l'entreprise (ex. 'Pharmacien titulaire')."
    )
    citation: str = Field(
        default="",
        description=(
            "URL exacte de la source qui justifie ce contact, copiée depuis la "
            "prose de recherche. Laisse vide si non disponible."
        ),
    )


class _SupplementalContacts(BaseModel):
    contacts: list[_SupplementalContact] = Field(default_factory=list)


def _ai_source_domains(ai_sources) -> list[str]:
    """Extract deduplicated hostnames from `segment.ai_sources` for `site:` queries.

    Soft-fails on garbage entries. Strips scheme and leading ``www.``.
    """
    out: list[str] = []
    seen: set[str] = set()
    for src in ai_sources or []:
        url = (src.get("url") if isinstance(src, dict) else getattr(src, "url", "")) or ""
        url = url.strip()
        if not url:
            continue
        try:
            parsed = urlparse(url if "://" in url else f"https://{url}")
            host = (parsed.hostname or "").lower().removeprefix("www.")
        except Exception:  # noqa: BLE001
            host = ""
        if host and host not in seen:
            seen.add(host)
            out.append(host)
    return out


def _build_search_agent_instruction(
    segment,
    sourcing_instruction: str,
    ai_source_domains: list[str],
    ai_sources_raw: list,
) -> str:
    """System prompt for Agent 1 (grounded researcher, prose output).

    When at least one `ai_sources` URL parses to a hostname, the prompt
    enforces a `site:<domain>` query as the first action. Otherwise the
    historical branch ("1 à 3 recherches ciblées") is used — keeps
    backward compat for segments without `ai_sources`.
    """
    postes = list(getattr(segment, "postes", None) or []) if segment else []
    activite = list(getattr(segment, "activite_ciblee", None) or []) if segment else []
    zone = list(getattr(segment, "zone_geographique", None) or []) if segment else []

    lines = [
        "Tu es un agent de recherche commerciale BtoB français. Mission : "
        "recenser les contacts (nom + rôle) pertinents au sein d'une entreprise "
        "donnée en t'appuyant exclusivement sur des recherches Google grounded.",
    ]
    if postes:
        lines.append("Rôles cibles prioritaires : " + ", ".join(postes) + ".")
    if activite:
        lines.append(f"Activité ciblée : {', '.join(activite)}.")
    if zone:
        lines.append(f"Zone géographique : {', '.join(zone)}.")

    if ai_source_domains:
        lines.append(
            "Sources web prioritaires (annuaires métier configurés par "
            "l'utilisateur) :"
        )
        for src in ai_sources_raw:
            url = (src.get("url") if isinstance(src, dict) else getattr(src, "url", "")) or ""
            desc = (src.get("description") if isinstance(src, dict) else getattr(src, "description", "")) or ""
            url, desc = url.strip(), desc.strip()
            if not url and not desc:
                continue
            lines.append(f"- {url} — {desc}" if (url and desc) else f"- {url or desc}")
        first_domain = ai_source_domains[0]
        primary_role = postes[0] if postes else "dirigeant"
        lines.append(
            "RÈGLE DE RECHERCHE OBLIGATOIRE : démarre par AU MOINS UNE requête "
            "Google utilisant l'opérateur `site:` sur l'un de ces domaines "
            f"({', '.join(ai_source_domains)}). Exemples concrets (adapte au "
            "nom exact, à la ville, au code postal et au rôle ciblé) :\n"
            f"  - `site:{first_domain} \"<NOM_ENTREPRISE>\" <ville>`\n"
            f"  - `site:{first_domain} {primary_role} \"<NOM_ENTREPRISE>\"`\n"
            f"  - `site:{first_domain} <code_postal> \"<NOM_ENTREPRISE>\"`\n"
            "Si la requête `site:` ne ramène rien d'exploitable, fais 1 à 2 "
            "recherches Google génériques en repli. Total : 2 à 4 recherches."
        )
    else:
        lines.append(
            "Effectue 1 à 3 recherches Google ciblées (nom de l'entreprise + "
            "ville, site officiel, registres ou annuaires publics pertinents)."
        )

    override = (sourcing_instruction or "").strip()
    if override:
        lines.append(
            "Instructions complémentaires de l'utilisateur (priment sur le "
            f"reste) : {override}"
        )

    lines.append(
        "Format de réponse : prose libre en français, dense et factuelle. "
        "Liste chaque contact identifié avec son rôle et — entre parenthèses — "
        "l'URL EXACTE de la page qui le confirme. N'invente JAMAIS un nom : si "
        "aucun contact fiable, écris explicitement « Aucun contact fiable "
        "identifié. ». PAS de JSON, PAS de liste markdown : un autre agent "
        "structurera la sortie ensuite."
    )
    return "\n\n".join(lines)


async def _run_contact_search(
    entreprise: str,
    adresse: str,
    ville: str,
    code_postal: str,
    segment,
    sourcing_instruction: str,
    ai_source_domains: list[str],
    ai_sources_raw: list,
) -> tuple[str, list[GroundingSource]]:
    """Agent 1 — grounded research. Returns (prose, grounding_chunks)."""
    system = _build_search_agent_instruction(
        segment, sourcing_instruction, ai_source_domains, ai_sources_raw
    )
    ctx_lines = [f"Entreprise : {entreprise}"]
    if adresse:
        ctx_lines.append(f"Adresse : {adresse}")
    loc = " ".join(p for p in [code_postal, ville] if p).strip()
    if loc:
        ctx_lines.append(f"Ville : {loc}")
    activite = list(getattr(segment, "activite_ciblee", None) or []) if segment else []
    if activite:
        ctx_lines.append(f"Activité ciblée : {', '.join(activite)}")
    ctx_lines.append(
        "Trouve les contacts pertinents (cf. rôles cibles) en respectant la "
        "règle de recherche imposée par le system prompt. Cite l'URL exacte "
        "de la page-source de chaque contact identifié."
    )
    user_message = "\n".join(ctx_lines)

    client = get_client()
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.2,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        # Contact-search via google_search: low deliberation is enough — the
        # search results are the substance. Saves thinking tokens vs medium.
        thinking_config=types.ThinkingConfig(thinking_level="low"),
    )
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_SOURCING_MODEL,
        contents=user_message,
        config=config,
    )
    sources, queries = extract_sources(response)
    if queries:
        logger.info(
            "contact_search agent: %d query(ies) for %r — first=%r",
            len(queries), entreprise, queries[0],
        )
    return (getattr(response, "text", "") or "", sources)


async def _run_contact_extraction(
    prose: str, postes: list[str]
) -> _SupplementalContacts:
    """Agent 2 — turn Agent 1's prose into a schema-bound contact list."""
    roles_hint = ", ".join(postes) if postes else "(rôles libres)"
    system = (
        "Tu es un extracteur. À partir de la note de recherche ci-dessous, "
        "produis une liste de contacts au format JSON conforme au schéma. "
        f"N'inclus QUE les personnes dont le rôle correspond à : {roles_hint}. "
        "Pour chaque contact, recopie l'URL exacte citée dans la prose dans le "
        "champ `citation`. Si l'URL n'est pas explicite, laisse `citation` vide. "
        "N'INVENTE AUCUN contact qui ne figure pas explicitement dans la note. "
        "Si la note dit qu'aucun contact fiable n'a été trouvé, renvoie une "
        "liste vide."
    )
    client = get_client()
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.0,
        response_mime_type="application/json",
        response_schema=_SupplementalContacts,
        # Extraction = pure JSON shaping, no reasoning needed.
        thinking_config=types.ThinkingConfig(thinking_level="minimal"),
        max_output_tokens=2048,
    )
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prose,
        config=config,
    )
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, _SupplementalContacts):
        return parsed
    text = getattr(response, "text", "") or ""
    try:
        return _SupplementalContacts.model_validate_json(text)
    except Exception:  # noqa: BLE001
        logger.warning(
            "contact_extraction: parse failed (head=%r)", text[:200]
        )
        return _SupplementalContacts()


async def fetch_supplemental_contacts(
    entreprise: str,
    ville: str = "",
    code_postal: str = "",
    adresse: str = "",
    segment=None,
    sourcing_instruction: str = "",
) -> tuple[list[dict[str, str]], list[GroundingSource]]:
    """Return ``(contacts, sources)`` via the chained agent pipeline.

    ``contacts`` is a list of ``{nom, role, source}`` dicts with per-contact
    provenance:
      - ``ai_grounding_verified`` when the contact's citation can be matched
        to a grounding_chunk URI returned by Agent 1, or to a hostname listed
        in ``segment.ai_sources``.
      - ``ai_grounding`` otherwise.

    ``sources`` is the full list of grounding URIs the contact-search agent
    actually visited (Google Search results). Callers can surface these to
    the UI so the user can audit the enrichment pipeline.

    Soft-fails (empty lists) on any error. Returns ``([], [])`` without an
    API call when nothing in the segment or the instruction tells the agent
    what to look for (no postes, no ai_sources, no override).
    """
    if not entreprise:
        return [], []
    has_postes = bool(getattr(segment, "postes", None)) if segment else False
    has_ai_sources = bool(getattr(segment, "ai_sources", None)) if segment else False
    has_override = bool((sourcing_instruction or "").strip())
    if not (has_postes or has_ai_sources or has_override):
        return [], []

    ai_sources_raw = list(getattr(segment, "ai_sources", None) or []) if segment else []
    ai_source_domains = _ai_source_domains(ai_sources_raw)
    postes = list(getattr(segment, "postes", None) or []) if segment else []

    try:
        prose, sources = await _run_contact_search(
            entreprise=entreprise,
            adresse=adresse,
            ville=ville,
            code_postal=code_postal,
            segment=segment,
            sourcing_instruction=sourcing_instruction,
            ai_source_domains=ai_source_domains,
            ai_sources_raw=ai_sources_raw,
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "contact_search agent failed for %r", entreprise
        )
        return [], []

    if not (prose or "").strip():
        return [], list(sources or [])

    try:
        extracted = await _run_contact_extraction(prose, postes)
    except Exception:  # noqa: BLE001
        logger.exception(
            "contact_extraction agent failed for %r", entreprise
        )
        return [], list(sources or [])

    trusted_uris = {s.uri for s in sources if getattr(s, "uri", "")}
    ai_domains_set = set(ai_source_domains)

    def _is_verified(citation: str) -> bool:
        if not citation:
            return False
        if citation in trusted_uris:
            return True
        try:
            host = (urlparse(citation).hostname or "").lower().removeprefix("www.")
        except Exception:  # noqa: BLE001
            return False
        return bool(host) and any(
            host == d or host.endswith(f".{d}") for d in ai_domains_set
        )

    out: list[dict[str, str]] = []
    for c in extracted.contacts:
        nom = c.nom.strip()
        if not nom:
            continue
        out.append({
            "nom": nom,
            "role": c.role.strip(),
            "source": "ai_grounding_verified" if _is_verified(c.citation) else "ai_grounding",
        })
    return out, list(sources or [])


