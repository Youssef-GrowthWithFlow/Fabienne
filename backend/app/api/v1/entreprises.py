from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.entreprise import Entreprise
from app.models.enums import FIELD_SOURCES
from app.models.prospect import Prospect
from app.models.segment import Segment
from app.schemas.entreprise import (
    BulkCreateRequest,
    EntrepriseCreate,
    EntrepriseRead,
    EntrepriseUpdate,
    GenerateEntreprisesRequest,
    GenerateEntreprisesResponse,
)
from app.schemas.prospect import ProspectRead
from app.services.actions import log_action
from app.services.sourcer import generate_entreprises

router = APIRouter(prefix="/entreprises", tags=["entreprises"])


async def _get_or_404(db: AsyncSession, entreprise_id: str) -> Entreprise:
    obj = await db.get(Entreprise, entreprise_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Entreprise not found")
    return obj


@router.get(
    "",
    response_model=list[EntrepriseRead],
    response_model_by_alias=True,
)
async def list_entreprises(
    segment_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Entreprise]:
    stmt = select(Entreprise).order_by(Entreprise.created_at.desc())
    if segment_id:
        stmt = stmt.where(Entreprise.segment_id == segment_id)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post(
    "",
    response_model=EntrepriseRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_entreprise(
    payload: EntrepriseCreate,
    db: AsyncSession = Depends(get_db),
) -> Entreprise:
    data = payload.model_dump(by_alias=False)
    obj = Entreprise(**data)
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.refresh(obj)
    return obj


@router.get(
    "/{entreprise_id}",
    response_model=EntrepriseRead,
    response_model_by_alias=True,
)
async def get_entreprise(
    entreprise_id: str, db: AsyncSession = Depends(get_db)
) -> Entreprise:
    return await _get_or_404(db, entreprise_id)


@router.put(
    "/{entreprise_id}",
    response_model=EntrepriseRead,
    response_model_by_alias=True,
)
async def update_entreprise(
    entreprise_id: str,
    payload: EntrepriseUpdate,
    db: AsyncSession = Depends(get_db),
) -> Entreprise:
    obj = await _get_or_404(db, entreprise_id)
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    for key, value in data.items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete(
    "/{entreprise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_entreprise(
    entreprise_id: str, db: AsyncSession = Depends(get_db)
) -> Response:
    obj = await _get_or_404(db, entreprise_id)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# AI generation + bulk commit
# ---------------------------------------------------------------------------


@router.post(
    "/generate",
    response_model=GenerateEntreprisesResponse,
    response_model_by_alias=True,
)
async def generate_endpoint(
    payload: GenerateEntreprisesRequest,
    db: AsyncSession = Depends(get_db),
) -> GenerateEntreprisesResponse:
    segment = None
    if payload.segment_id:
        segment = await db.get(Segment, payload.segment_id)
        if segment is None:
            raise HTTPException(status_code=404, detail="Segment not found")
    try:
        return await generate_entreprises(
            db, segment, payload.instruction, payload.count
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


class _BulkResponse(EntrepriseRead):
    pass


@router.post(
    "/bulk",
    status_code=status.HTTP_201_CREATED,
)
async def bulk_create_endpoint(
    payload: BulkCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.segment_id:
        segment = await db.get(Segment, payload.segment_id)
        if segment is None:
            raise HTTPException(status_code=404, detail="Segment not found")

    created_entreprises: list[Entreprise] = []
    created_prospects: list[Prospect] = []
    # Track which prospects came from the API gouv ``dirigeants`` payload so
    # we can stamp their per-field provenance accordingly.
    prospect_initial_sources: list[dict[str, str]] = []
    today = date.today()

    try:
        for item in payload.entreprises:
            entreprise_data = item.model_dump(
                by_alias=False,
                exclude={"contacts"},
                exclude_none=True,
            )
            # Pydantic gives us list[DirigeantSchema] objects → flatten to dicts
            # so the JSON column stores plain {"nom","qualite"} entries.
            dirigeants = entreprise_data.get("dirigeants")
            if dirigeants:
                entreprise_data["dirigeants"] = [
                    {"nom": d.get("nom", ""), "qualite": d.get("qualite", "")}
                    if isinstance(d, dict)
                    else {"nom": d.nom, "qualite": d.qualite}
                    for d in dirigeants
                ]
            ent = Entreprise(segment_id=payload.segment_id, **entreprise_data)
            db.add(ent)
            await db.flush()
            created_entreprises.append(ent)

            ent_dirigeants = ent.dirigeants or []
            dirigeant_keys = {
                (d.get("nom", "").strip().lower(), d.get("qualite", "").strip().lower())
                for d in ent_dirigeants
                if isinstance(d, dict)
            }

            for contact in item.contacts:
                nom = (contact.nom or "").strip()
                role = (contact.role or "").strip()
                if not nom and not role:
                    continue
                explicit_source = (contact.source or "").strip()
                if explicit_source in FIELD_SOURCES:
                    source = explicit_source
                elif dirigeant_keys and (nom.lower(), role.lower()) in dirigeant_keys:
                    source = "api_gouv"
                else:
                    source = "gemini"
                init_sources: dict[str, str] = {}
                if nom:
                    init_sources["nom"] = source
                if role:
                    init_sources["role"] = source
                prospect = Prospect(
                    nom=nom,
                    role=role,
                    entreprise_id=ent.id,
                    status="À contacter",
                    created_at=today,
                    field_sources=init_sources,
                )
                db.add(prospect)
                await db.flush()
                await log_action(db, prospect, kind="created")
                created_prospects.append(prospect)
                prospect_initial_sources.append(init_sources)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    for ent in created_entreprises:
        await db.refresh(ent)
    for prospect in created_prospects:
        await db.refresh(prospect)
        # Eager-load the entreprise relation for the response payload.
        _ = prospect.entreprise

    return {
        "entreprises": [
            EntrepriseRead.model_validate(ent).model_dump(by_alias=True, mode="json")
            for ent in created_entreprises
        ],
        "prospects": [
            ProspectRead.model_validate(p).model_dump(by_alias=True, mode="json")
            for p in created_prospects
        ],
    }
