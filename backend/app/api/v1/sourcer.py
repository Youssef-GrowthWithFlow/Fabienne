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
from app.services.enrichment import build_entreprise_fiche
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


@router.post(
    "/run",
    response_model=SourcerRunResponse,
    response_model_by_alias=True,
)
async def run_sourcing(
    payload: SourcerRunRequest,
    db: AsyncSession = Depends(get_db),
) -> SourcerRunResponse:
    segment = None
    if payload.segment_id:
        segment = await db.get(Segment, payload.segment_id)
        if segment is None:
            raise HTTPException(status_code=404, detail="Segment not found")
    try:
        result = await generate_entreprises(
            db, segment, payload.instruction, payload.count
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    persisted = await _persist_run(
        db, payload.segment_id, payload.instruction, result.candidates,
    )
    return SourcerRunResponse(
        candidates=[SourcedCandidateRead.model_validate(r) for r in persisted],
        search_queries=result.search_queries,
    )


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


async def _get_or_404(db: AsyncSession, candidate_id: str) -> SourcedCandidate:
    obj = await db.get(SourcedCandidate, candidate_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return obj


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
    obj = await _get_or_404(db, candidate_id)
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
    obj = await _get_or_404(db, candidate_id)
    obj.status = "refused"
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/candidates/{candidate_id}/validate")
async def validate_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    obj = await _get_or_404(db, candidate_id)
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
    """Background enrichment: fiche (Gemini) + DropContact contact lookup.

    Opens its own DB session — the request-scoped session is gone by the
    time this runs. Both calls are launched in parallel; each soft-fails
    without crashing the other.
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

            fiche_task = asyncio.ensure_future(
                build_entreprise_fiche(
                    entreprise,
                    segment,
                    contact_nom=contact_nom,
                    contact_role=contact_role,
                )
            )
            dc_task: asyncio.Future | None = None
            if prospect is not None and contact_nom:
                dc_task = asyncio.ensure_future(
                    dropcontact.enrich(
                        nom=contact_nom,
                        entreprise=entreprise.entreprise,
                        website=entreprise.site_web or "",
                        linkedin=prospect.linkedin or "",
                    )
                )

            tasks: list[asyncio.Future] = [fiche_task]
            if dc_task is not None:
                tasks.append(dc_task)
            results = await asyncio.gather(*tasks, return_exceptions=True)
            fiche_result = results[0]
            dc_result = results[1] if dc_task is not None else None

            if isinstance(fiche_result, BaseException):
                logger.exception(
                    "Background fiche generation failed for entreprise %s",
                    entreprise_id, exc_info=fiche_result,
                )
            else:
                html, _sources, _queries = fiche_result
                if html:
                    entreprise.fiche_client = html

            if (
                prospect is not None
                and dc_result is not None
                and not isinstance(dc_result, BaseException)
            ):
                _apply_dropcontact_to_prospect(prospect, dc_result)
            elif isinstance(dc_result, BaseException):
                logger.exception(
                    "Background DropContact enrichment failed for prospect %s",
                    prospect_id, exc_info=dc_result,
                )

            await bg_db.commit()
            logger.info(
                "Background enrichment done for entreprise %s (prospect=%s, "
                "fiche=%s, dropcontact=%s)",
                entreprise_id, prospect_id,
                "ok" if not isinstance(fiche_result, BaseException) else "fail",
                "ok" if (
                    dc_task is not None
                    and not isinstance(dc_result, BaseException)
                ) else "skip/fail",
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "Background enrichment crashed for entreprise %s",
                entreprise_id,
            )


def _apply_dropcontact_to_prospect(
    prospect: Prospect, dc: dropcontact.DropContactEnrichment,
) -> None:
    """Patch a Prospect in-place with DropContact enrichment.

    Only writes fields that DropContact actually returned, and tags each
    written field with ``"dropcontact"`` in ``field_sources``. ``email`` is
    only accepted when the qualification is not ``"invalid"``.
    """
    sources = dict(prospect.field_sources or {})
    if dc.email and dc.email_qualification != "invalid":
        prospect.email = dc.email
        sources["email"] = "dropcontact"
    # Mobile phone wins over landline when both are present (more useful for
    # outbound BtoB).
    if dc.mobile_phone:
        prospect.telephone = dc.mobile_phone
        sources["telephone"] = "dropcontact"
    elif dc.phone:
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
