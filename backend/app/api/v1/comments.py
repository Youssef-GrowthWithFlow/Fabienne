from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentRead, CommentUpdate

router = APIRouter(
    prefix="/prospects/{prospect_id}/comments",
    tags=["comments"],
)


async def _get_comment_or_404(
    db: AsyncSession, prospect_id: str, comment_id: str
) -> Comment:
    obj = await db.get(Comment, comment_id)
    if obj is None or obj.prospect_id != prospect_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    return obj


@router.get("", response_model=list[CommentRead])
async def list_comments(
    prospect_id: str, db: AsyncSession = Depends(get_db)
) -> list[Comment]:
    result = await db.execute(
        select(Comment)
        .where(Comment.prospect_id == prospect_id)
        .order_by(Comment.date.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def create_comment(
    prospect_id: str,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
) -> Comment:
    data = payload.model_dump(exclude_none=True)
    obj = Comment(prospect_id=prospect_id, **data)
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError:
        raise HTTPException(status_code=404, detail="Prospect not found")
    await db.refresh(obj)
    return obj


@router.put("/{comment_id}", response_model=CommentRead)
async def update_comment(
    prospect_id: str,
    comment_id: str,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
) -> Comment:
    obj = await _get_comment_or_404(db, prospect_id, comment_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    prospect_id: str,
    comment_id: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    obj = await _get_comment_or_404(db, prospect_id, comment_id)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
