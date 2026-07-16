from datetime import date

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1._helpers import get_or_404
from app.core.database import get_db
from app.models.entreprise import Entreprise
from app.models.prospect import Prospect
from app.schemas.prospect import ProspectCreate, ProspectRead, ProspectUpdate
from app.services.actions import KIND_TO_STATUS, log_action

router = APIRouter(prefix="/prospects", tags=["prospects"])

STATUS_TO_KIND = {v: k for k, v in KIND_TO_STATUS.items()}


def _payload_to_db(data: dict) -> dict:
    out = dict(data)
    for key in ("created_at", "contacted_at", "relance_date"):
        v = out.get(key)
        if isinstance(v, str):
            out[key] = date.fromisoformat(v) if v else None
    return out


@router.get("", response_model=list[ProspectRead], response_model_by_alias=True)
async def list_prospects(db: AsyncSession = Depends(get_db)) -> list[Prospect]:
    result = await db.execute(select(Prospect).order_by(Prospect.created_at.desc()))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ProspectRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_prospect(
    payload: ProspectCreate, db: AsyncSession = Depends(get_db)
) -> Prospect:
    data = _payload_to_db(payload.model_dump(by_alias=False))
    entreprise_nom = data.pop("entreprise_nom", "").strip()
    if not data.get("entreprise_id") and entreprise_nom:
        existing = await db.scalar(
            select(Entreprise)
            .where(func.lower(Entreprise.entreprise) == entreprise_nom.lower())
            .limit(1)
        )
        ent = existing or Entreprise(
            entreprise=entreprise_nom,
            origine="Manuel",
            field_sources={"entreprise": "manual"},
        )
        if existing is None:
            db.add(ent)
            await db.flush()
        data["entreprise_id"] = ent.id
    # A fresh contact comes with its first task: reach out today. Only when
    # the caller didn't plan anything themselves and the contact is still
    # to be worked.
    if not data.get("relance_date") and data.get("status") in (None, "À contacter"):
        data["relance_date"] = date.today()
        if not (data.get("relance_note") or "").strip():
            data["relance_note"] = "le contacter"
    obj = Prospect(**data)
    db.add(obj)
    await db.flush()
    await log_action(db, obj, kind="created")
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/{prospect_id}", response_model=ProspectRead, response_model_by_alias=True)
async def get_prospect(
    prospect_id: str, db: AsyncSession = Depends(get_db)
) -> Prospect:
    return await get_or_404(db, Prospect, prospect_id)


@router.put("/{prospect_id}", response_model=ProspectRead, response_model_by_alias=True)
async def update_prospect(
    prospect_id: str,
    payload: ProspectUpdate,
    db: AsyncSession = Depends(get_db),
) -> Prospect:
    obj = await get_or_404(db, Prospect, prospect_id)
    old_status = obj.status
    data = _payload_to_db(payload.model_dump(by_alias=False))
    for key, value in data.items():
        setattr(obj, key, value)

    new_status = obj.status
    if old_status != new_status and new_status in STATUS_TO_KIND:
        await log_action(
            db,
            obj,
            kind=STATUS_TO_KIND[new_status],
            metadata={"from": old_status, "to": new_status},
        )

    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{prospect_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prospect(
    prospect_id: str, db: AsyncSession = Depends(get_db)
) -> Response:
    obj = await get_or_404(db, Prospect, prospect_id)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
