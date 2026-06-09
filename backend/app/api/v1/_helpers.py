from typing import TypeVar

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base

T = TypeVar("T", bound=Base)


async def get_or_404(
    db: AsyncSession,
    model: type[T],
    obj_id,
    *,
    label: str | None = None,
) -> T:
    obj = await db.get(model, obj_id)
    if obj is None:
        raise HTTPException(
            status_code=404, detail=f"{label or model.__name__} not found"
        )
    return obj
