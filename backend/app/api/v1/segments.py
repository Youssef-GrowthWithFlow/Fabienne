from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.segment import Segment
from app.schemas.segment import SegmentCreate, SegmentRead, SegmentUpdate

router = APIRouter(
    prefix="/segments",
    tags=["segments"],
)


async def _get_or_404(db: AsyncSession, segment_id: str) -> Segment:
    obj = await db.get(Segment, segment_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    return obj


@router.get("", response_model=list[SegmentRead], response_model_by_alias=True)
async def list_segments(db: AsyncSession = Depends(get_db)) -> list[Segment]:
    result = await db.execute(select(Segment).order_by(Segment.created_at.desc()))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=SegmentRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_segment(
    payload: SegmentCreate, db: AsyncSession = Depends(get_db)
) -> Segment:
    obj = Segment(**payload.model_dump(by_alias=False))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/{segment_id}", response_model=SegmentRead, response_model_by_alias=True)
async def get_segment(
    segment_id: str, db: AsyncSession = Depends(get_db)
) -> Segment:
    return await _get_or_404(db, segment_id)


@router.put("/{segment_id}", response_model=SegmentRead, response_model_by_alias=True)
async def update_segment(
    segment_id: str,
    payload: SegmentUpdate,
    db: AsyncSession = Depends(get_db),
) -> Segment:
    obj = await _get_or_404(db, segment_id)
    for key, value in payload.model_dump(by_alias=False).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(
    segment_id: str, db: AsyncSession = Depends(get_db)
) -> Response:
    obj = await _get_or_404(db, segment_id)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
