from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.prospect import Prospect
from app.schemas.prospect import ProspectCreate, ProspectRead, ProspectUpdate
from app.services.actions import KIND_TO_STATUS, log_action

router = APIRouter(prefix="/prospects", tags=["prospects"])

STATUS_TO_KIND = {v: k for k, v in KIND_TO_STATUS.items()}


async def _get_or_404(db: AsyncSession, prospect_id: str) -> Prospect:
    obj = await db.get(Prospect, prospect_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return obj


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
    return await _get_or_404(db, prospect_id)


@router.put("/{prospect_id}", response_model=ProspectRead, response_model_by_alias=True)
async def update_prospect(
    prospect_id: str,
    payload: ProspectUpdate,
    db: AsyncSession = Depends(get_db),
) -> Prospect:
    obj = await _get_or_404(db, prospect_id)
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
    obj = await _get_or_404(db, prospect_id)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
