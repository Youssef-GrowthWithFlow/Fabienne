import secrets
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _comment_id() -> str:
    return secrets.token_hex(8)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_comment_id)
    prospect_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("prospects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("actions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    texte: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
