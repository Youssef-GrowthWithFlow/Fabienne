import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1._helpers import get_or_404
from app.core.database import get_db
from app.models.entreprise import Entreprise
from app.models.segment import Segment
from app.schemas.entreprise import (
    EntrepriseCreate,
    EntrepriseRead,
    EntrepriseUpdate,
)
from app.services.enrichment import (
    build_entreprise_fiche,
    complete_entreprise_fields,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/entreprises", tags=["entreprises"])


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
    return await get_or_404(db, Entreprise, entreprise_id)


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
    obj = await get_or_404(db, Entreprise, entreprise_id)
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
    obj = await get_or_404(db, Entreprise, entreprise_id)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{entreprise_id}/regenerate-fiche",
    response_model=EntrepriseRead,
    response_model_by_alias=True,
)
async def regenerate_fiche_endpoint(
    entreprise_id: str,
    db: AsyncSession = Depends(get_db),
) -> Entreprise:
    entreprise = await get_or_404(db, Entreprise, entreprise_id)
    segment = (
        await db.get(Segment, entreprise.segment_id)
        if entreprise.segment_id
        else None
    )
    # Fill the empty fields (site web, téléphone, adresse, SIRET, dirigeants…)
    # BEFORE the fiche call so the fiche prompt benefits from them too.
    # Committed on its own: the fields must survive even if the fiche fails.
    try:
        if await complete_entreprise_fields(entreprise):
            await db.commit()
            await db.refresh(entreprise)
    except Exception:  # noqa: BLE001 — enrichment is best-effort
        logger.exception("Field completion failed for %r", entreprise_id)
    try:
        html, _sources, _queries = await build_entreprise_fiche(entreprise, segment)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except Exception as exc:
        logger.exception("Fiche regeneration failed for %r", entreprise_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Fiche regeneration failed: {exc}",
        ) from exc

    if html:
        entreprise.fiche_client = html
        await db.commit()
        await db.refresh(entreprise)
    return entreprise
