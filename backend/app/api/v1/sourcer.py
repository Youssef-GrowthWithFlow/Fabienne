"""Sourcer history endpoints — persist runs, list, validate / refuse.

The Sourcer page calls these instead of /entreprises/generate so that every
candidate proposed by the AI is recorded (pending) and either promoted to
a real Entreprise (validated) or kept around as a refused entry to avoid
re-proposing it.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.api.v1._helpers import get_or_404
from app.core.database import AsyncSessionLocal, get_db
from app.models.entreprise import Entreprise
from app.models.enums import FIELD_SOURCES
from app.models.prospect import Prospect
from app.models.segment import Segment
from app.models.sourced_candidate import SourcedCandidate
from app.schemas.entreprise import EntrepriseRead, ProposedEntreprise
from app.schemas.prospect import ProspectRead
from app.schemas.sourced_candidate import (
    SourcedCandidateRead,
    SourcedCandidateUpdate,
    SourcerRunRequest,
    SourcerRunResponse,
)
from app.services import dropcontact
from app.services.actions import log_action
from app.services.enrichment import (
    build_entreprise_fiche,
    extract_fiche_coordonnees,
)
from app.services.sourcer import generate_entreprises

router = APIRouter(prefix="/sourcer", tags=["sourcer"])


# Strong refs to fire-and-forget background tasks. asyncio.create_task only
# weakly references its tasks via the event loop — without a strong ref a
# task can be garbage-collected mid-flight (silent loss). We add finished
# tasks back to the set's GC root, then discard them via done_callback.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _spawn_background(coro) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)
    return task


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


@router.get(
    "/candidates",
    response_model=list[SourcedCandidateRead],
    response_model_by_alias=True,
)
async def list_candidates(
    status_filter: str | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
) -> list[SourcedCandidate]:
    stmt = (
        select(SourcedCandidate)
        .order_by(SourcedCandidate.created_at.desc())
        .limit(limit)
    )
    if status_filter in {"pending", "validated", "refused"}:
        stmt = stmt.where(SourcedCandidate.status == status_filter)
    res = await db.execute(stmt)
    return list(res.scalars().all())


# ---------------------------------------------------------------------------
# Run (generate + persist)
# ---------------------------------------------------------------------------


async def _persist_run(
    db: AsyncSession,
    segment_id: str | None,
    instruction: str,
    candidates: list[ProposedEntreprise],
) -> list[SourcedCandidate]:
    """Persist a list of ProposedEntreprise as pending SourcedCandidate rows."""
    persisted: list[SourcedCandidate] = []
    for proposed in candidates:
        snapshot = proposed.model_dump(by_alias=True, mode="json")
        row = SourcedCandidate(
            status="pending",
            segment_id=segment_id,
            instruction=instruction,
            payload=snapshot,
            main_contact_index=0,
        )
        db.add(row)
        persisted.append(row)
    await db.commit()
    for row in persisted:
        await db.refresh(row)
    return persisted


@router.post("/run/stream")
async def run_sourcing_stream(
    payload: SourcerRunRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Same as ``/run`` but streams per-phase progress via SSE.

    The runner is **detached** from the SSE connection: closing the browser
    tab or refreshing the page does NOT cancel the sourcing — it just stops
    the live stream. The Gemini call + persistence run to completion in
    background. The user finds the persisted candidates when they reopen
    the page. This avoids burning tokens for a run that gets thrown away
    on every page reload.

    Frame format (one per ``\\n\\n``-delimited block) :

        data: {"type": "phase", "phase": "...", "message": "...", "current"?: N, "total"?: M}
        data: {"type": "result", "data": <SourcerRunResponse>}
        data: {"type": "error", "message": "..."}
    """
    if payload.segment_id:
        segment_exists = await db.get(Segment, payload.segment_id)
        if segment_exists is None:
            raise HTTPException(status_code=404, detail="Segment not found")

    # The queue lives in the request scope but is filled by the detached
    # runner. If the client disconnects, the queue is simply abandoned —
    # the runner keeps publishing into a dead queue (cheap, bounded) and
    # persists its result regardless.
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def progress(event: dict[str, Any]) -> None:
        await queue.put({"type": "phase", **event})

    async def runner() -> None:
        # Detached runner uses its OWN DB session — the request-scoped one
        # closes as soon as the response is sent (or the client disconnects).
        async with AsyncSessionLocal() as bg_db:
            try:
                segment = (
                    await bg_db.get(Segment, payload.segment_id)
                    if payload.segment_id
                    else None
                )
                result = await generate_entreprises(
                    bg_db,
                    segment,
                    payload.instruction,
                    payload.count,
                    progress=progress,
                )
                persisted = await _persist_run(
                    bg_db,
                    payload.segment_id,
                    payload.instruction,
                    result.candidates,
                )
                data = SourcerRunResponse(
                    candidates=[
                        SourcedCandidateRead.model_validate(r) for r in persisted
                    ],
                    search_queries=result.search_queries,
                ).model_dump(by_alias=True, mode="json")
                await queue.put({"type": "result", "data": data})
                logger.info(
                    "run_sourcing_stream: persisted %d candidate(s) "
                    "(client_may_have_disconnected=ignored)",
                    len(persisted),
                )
            except Exception as exc:  # noqa: BLE001 — surface to client
                logger.exception("run_sourcing_stream failed")
                await queue.put({"type": "error", "message": str(exc)})
            finally:
                await queue.put(None)

    _spawn_background(runner())

    async def event_stream():
        # Best-effort streaming: yield while we can. If the client closes
        # the connection, this coroutine raises CancelledError and we stop
        # — but the runner is on its own task and keeps going.
        while True:
            evt = await queue.get()
            if evt is None:
                break
            yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # disable nginx buffering for live SSE
        },
    )


# ---------------------------------------------------------------------------
# Update / lifecycle
# ---------------------------------------------------------------------------


@router.patch(
    "/candidates/{candidate_id}",
    response_model=SourcedCandidateRead,
    response_model_by_alias=True,
)
async def update_candidate(
    candidate_id: str,
    patch: SourcedCandidateUpdate,
    db: AsyncSession = Depends(get_db),
) -> SourcedCandidate:
    obj = await get_or_404(db, SourcedCandidate, candidate_id, label="Candidate")
    if patch.main_contact_index is not None:
        obj.main_contact_index = max(0, patch.main_contact_index)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post(
    "/candidates/{candidate_id}/refuse",
    response_model=SourcedCandidateRead,
    response_model_by_alias=True,
)
async def refuse_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
) -> SourcedCandidate:
    obj = await get_or_404(db, SourcedCandidate, candidate_id, label="Candidate")
    obj.status = "refused"
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/candidates/{candidate_id}/validate")
async def validate_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    obj = await get_or_404(db, SourcedCandidate, candidate_id, label="Candidate")
    if obj.status == "validated" and obj.entreprise_id:
        # Idempotent — return the existing entreprise/prospect.
        ent = await db.get(Entreprise, obj.entreprise_id)
        prospect = (
            await db.get(Prospect, obj.prospect_id)
            if obj.prospect_id
            else None
        )
        return _validate_response(obj, ent, prospect)

    proposed = ProposedEntreprise.model_validate(obj.payload)
    contacts = list(proposed.contacts or [])
    main_idx = max(0, min(obj.main_contact_index, len(contacts) - 1)) if contacts else 0
    main_contact = contacts[main_idx] if contacts else None

    ent = Entreprise(
        segment_id=obj.segment_id,
        entreprise=proposed.entreprise,
        site_web=proposed.site_web,
        secteur=proposed.secteur,
        adresse=proposed.adresse,
        code_postal=proposed.code_postal,
        ville=proposed.ville,
        taille=proposed.taille,
        origine="Sourcer IA",
        note=proposed.raison,
        signaux=list(proposed.signaux or []),
        # The fiche generation starts right away in background — surface it.
        fiche_status="generating",
        siren=proposed.siren,
        siret=proposed.siret,
        naf_code=proposed.naf_code,
        naf_label=proposed.naf_label,
        effectif=proposed.effectif,
        date_creation=proposed.date_creation,
        dirigeants=[
            {"nom": c.nom, "qualite": c.role} for c in contacts
        ],
        field_sources=proposed.field_sources or {},
    )
    db.add(ent)
    await db.flush()

    prospect: Prospect | None = None
    if main_contact and (main_contact.nom or main_contact.role):
        source = (
            main_contact.source
            if main_contact.source in FIELD_SOURCES
            else "gemini"
        )
        init_sources: dict[str, str] = {}
        if main_contact.nom:
            init_sources["nom"] = source
        if main_contact.role:
            init_sources["role"] = source
        prospect = Prospect(
            nom=main_contact.nom.strip(),
            role=main_contact.role.strip(),
            entreprise_id=ent.id,
            status="À contacter",
            created_at=date.today(),
            field_sources=init_sources,
            # A fresh contact comes with its first task: reach out today.
            relance_date=date.today(),
            relance_note="le contacter",
            # Personal-info enrichment (online + DropContact) starts now.
            enrichment_status="generating",
        )
        db.add(prospect)
        await db.flush()
        await log_action(db, prospect, kind="created")

    obj.status = "validated"
    obj.entreprise_id = ent.id
    obj.prospect_id = prospect.id if prospect else None
    await db.commit()
    await db.refresh(obj)
    await db.refresh(ent)
    if prospect:
        await db.refresh(prospect)
        _ = prospect.entreprise

    # Post-validation enrichment (fiche Gemini + DropContact contact) runs
    # **in background** with its own DB session. The validate endpoint
    # returns in <2 s instead of waiting up to ~90 s for DropContact polling.
    # The user sees the prospect/entreprise immediately and can refresh the
    # sheet a moment later (or click Régénérer) to see the enriched data.
    contact_nom = main_contact.nom.strip() if main_contact else ""
    contact_role = main_contact.role.strip() if main_contact else ""
    _spawn_background(
        _enrich_after_validate(
            entreprise_id=ent.id,
            prospect_id=prospect.id if prospect else None,
            segment_id=obj.segment_id,
            contact_nom=contact_nom,
            contact_role=contact_role,
        )
    )

    return _validate_response(obj, ent, prospect)


async def _enrich_after_validate(
    entreprise_id: str,
    prospect_id: str | None,
    segment_id: str | None,
    contact_nom: str,
    contact_role: str,
) -> None:
    """Background enrichment: fiche (Gemini) + coordonnées, DropContact en filet.

    Opens its own DB session — the request-scoped session is gone by the
    time this runs. Sequence:

    1. Grounded fiche (Gemini + google_search) → committed as soon as ready.
    2. Structured extraction of the channels found ONLINE in the fiche —
       personal ones → prospect, generic ones (contact@, standard) →
       entreprise.
    3. DropContact ONLY if the AI sourcing found no personal channel at all
       (no email, no phone, no LinkedIn) — it costs credits, so it stays a
       fallback, never a systematic call.

    Lifecycle statuses (entreprise.fiche_status / prospect.enrichment_status)
    are kept up to date so the frontend can show live loaders.
    """
    async with AsyncSessionLocal() as bg_db:
        try:
            entreprise = await bg_db.get(Entreprise, entreprise_id)
            if entreprise is None:
                logger.warning(
                    "_enrich_after_validate: entreprise %s vanished",
                    entreprise_id,
                )
                return
            prospect = (
                await bg_db.get(Prospect, prospect_id)
                if prospect_id
                else None
            )
            segment = (
                await bg_db.get(Segment, segment_id) if segment_id else None
            )

            html = ""
            try:
                html, _sources, _queries = await build_entreprise_fiche(
                    entreprise,
                    segment,
                    contact_nom=contact_nom,
                    contact_role=contact_role,
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Background fiche generation failed for entreprise %s",
                    entreprise_id,
                )
            if html:
                entreprise.fiche_client = html
                entreprise.fiche_status = "ready"
            else:
                entreprise.fiche_status = "error"
            # The fiche is the long pole — commit it (and its status) as soon
            # as it lands so the polling UI stops its loader right away.
            await bg_db.commit()

            # Channels found online, straight from the grounded fiche.
            if html:
                coords = await extract_fiche_coordonnees(
                    html, contact_nom, contact_role, entreprise.entreprise
                )
                if coords is not None:
                    _apply_fiche_coordonnees(prospect, entreprise, coords)

            # DropContact fallback — only when the web search yielded no way
            # to reach the person.
            dc_called = False
            if (
                prospect is not None
                and contact_nom
                and not prospect.email
                and not prospect.telephone
                and not prospect.linkedin
            ):
                dc_called = True
                try:
                    dc_result = await dropcontact.enrich(
                        nom=contact_nom,
                        entreprise=entreprise.entreprise,
                        website=entreprise.site_web or "",
                        linkedin="",
                    )
                    if dc_result is not None:
                        _apply_dropcontact_to_prospect(
                            prospect, dc_result, entreprise
                        )
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "Background DropContact enrichment failed for prospect %s",
                        prospect_id,
                    )

            if prospect is not None:
                prospect.enrichment_status = "ready"
            await bg_db.commit()
            logger.info(
                "Background enrichment done for entreprise %s (prospect=%s, "
                "fiche=%s, dropcontact=%s)",
                entreprise_id, prospect_id,
                "ok" if html else "fail",
                "called" if dc_called else "skipped (canaux trouvés en ligne)",
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "Background enrichment crashed for entreprise %s",
                entreprise_id,
            )
            # Best effort: never leave the UI on an infinite loader.
            try:
                async with AsyncSessionLocal() as err_db:
                    ent = await err_db.get(Entreprise, entreprise_id)
                    if ent is not None and ent.fiche_status == "generating":
                        ent.fiche_status = "error"
                    if prospect_id:
                        pro = await err_db.get(Prospect, prospect_id)
                        if pro is not None and pro.enrichment_status == "generating":
                            pro.enrichment_status = "error"
                    await err_db.commit()
            except Exception:  # noqa: BLE001
                logger.exception("Could not mark enrichment statuses as error")


def _apply_fiche_coordonnees(
    prospect: Prospect | None,
    entreprise: Entreprise,
    coords,
) -> None:
    """Fill EMPTY fields with channels found online (grounded fiche).

    Personal channels → prospect, generic channels → entreprise. Never
    overwrites a value already present, and tags provenance with
    ``"ai_grounding"``.
    """
    if prospect is not None:
        sources = dict(prospect.field_sources or {})
        email = (coords.contact_email or "").strip()
        if email and not prospect.email:
            prospect.email = email
            sources["email"] = "ai_grounding"
        tel = (coords.contact_telephone or "").strip()
        if tel and not prospect.telephone:
            prospect.telephone = tel
            sources["telephone"] = "ai_grounding"
        linkedin = (coords.contact_linkedin or "").strip()
        if linkedin and not prospect.linkedin:
            prospect.linkedin = linkedin
            sources["linkedin"] = "ai_grounding"
        prospect.field_sources = sources

    ent_sources = dict(entreprise.field_sources or {})
    ent_email = (coords.entreprise_email or "").strip()
    if ent_email and not entreprise.email:
        entreprise.email = ent_email
        ent_sources["email"] = "ai_grounding"
    ent_tel = (coords.entreprise_telephone or "").strip()
    if ent_tel and not entreprise.telephone:
        entreprise.telephone = ent_tel
        ent_sources["telephone"] = "ai_grounding"
    ent_li = (coords.entreprise_linkedin or "").strip()
    if ent_li and not entreprise.linkedin:
        entreprise.linkedin = ent_li
        ent_sources["linkedin"] = "ai_grounding"
    entreprise.field_sources = ent_sources


def _apply_dropcontact_to_prospect(
    prospect: Prospect,
    dc: dropcontact.DropContactEnrichment,
    entreprise: Entreprise | None = None,
) -> None:
    """Patch a Prospect in-place with DropContact enrichment.

    Only writes fields that DropContact actually returned, and tags each
    written field with ``"dropcontact"`` in ``field_sources``. ``email`` is
    only accepted when the qualification is not ``"invalid"``; a generic
    inbox (``generic@pro`` — contact@, info@…) belongs to the entreprise,
    not to the person. A verified nominative email overrides one that was
    merely AI-grounded from the fiche.
    """
    sources = dict(prospect.field_sources or {})
    if dc.email and dc.email_qualification == "generic@pro":
        if entreprise is not None and not entreprise.email:
            entreprise.email = dc.email
            ent_sources = dict(entreprise.field_sources or {})
            ent_sources["email"] = "dropcontact"
            entreprise.field_sources = ent_sources
    elif dc.email and dc.email_qualification != "invalid":
        ai_filled = sources.get("email") == "ai_grounding"
        if not prospect.email or ai_filled:
            prospect.email = dc.email
            sources["email"] = "dropcontact"
    # Mobile phone wins over landline when both are present (more useful for
    # outbound BtoB). Never clobbers a manually-entered number.
    tel_overridable = not prospect.telephone or sources.get("telephone") in {
        "ai_grounding",
        "dropcontact",
    }
    if dc.mobile_phone and tel_overridable:
        prospect.telephone = dc.mobile_phone
        sources["telephone"] = "dropcontact"
    elif dc.phone and not prospect.telephone:
        prospect.telephone = dc.phone
        sources["telephone"] = "dropcontact"
    if dc.linkedin and not prospect.linkedin:
        prospect.linkedin = dc.linkedin
        sources["linkedin"] = "dropcontact"
    # Job title from DropContact is fresher than the role we got from the
    # sourcing flow — overwrite if it's non-empty.
    if dc.job:
        prospect.role = dc.job
        sources["role"] = "dropcontact"
    prospect.field_sources = sources


def _validate_response(
    obj: SourcedCandidate,
    ent: Entreprise | None,
    prospect: Prospect | None,
) -> dict[str, Any]:
    return {
        "candidate": SourcedCandidateRead.model_validate(obj).model_dump(
            by_alias=True, mode="json"
        ),
        "entreprise": (
            EntrepriseRead.model_validate(ent).model_dump(
                by_alias=True, mode="json"
            )
            if ent
            else None
        ),
        "prospect": (
            ProspectRead.model_validate(prospect).model_dump(
                by_alias=True, mode="json"
            )
            if prospect
            else None
        ),
    }
