from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.action import Action
from app.models.prospect import Prospect
from app.schemas.action import ActionCreate, ActionRead, ActionWithProspectRead
from app.services.actions import log_action

router = APIRouter(tags=["actions"])


@router.get(
    "/actions",
    response_model=list[ActionRead],
    response_model_by_alias=True,
)
async def list_actions(
    since: datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
) -> list[Action]:
    stmt = select(Action).order_by(Action.at.desc()).limit(limit)
    if since is not None:
        stmt = stmt.where(Action.at >= since)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/prospects/{prospect_id}/actions",
    response_model=list[ActionRead],
    response_model_by_alias=True,
)
async def list_prospect_actions(
    prospect_id: str, db: AsyncSession = Depends(get_db)
) -> list[Action]:
    prospect = await db.get(Prospect, prospect_id)
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    result = await db.execute(
        select(Action)
        .where(Action.prospect_id == prospect_id)
        .order_by(Action.at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/prospects/{prospect_id}/actions",
    response_model=ActionWithProspectRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_prospect_action(
    prospect_id: str,
    payload: ActionCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    prospect = await db.get(Prospect, prospect_id)
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    action = await log_action(
        db,
        prospect,
        kind=payload.kind.value,
        metadata=payload.meta,
        at=payload.at,
    )
    await db.commit()
    await db.refresh(prospect)
    return {"action": action, "prospect": prospect}
