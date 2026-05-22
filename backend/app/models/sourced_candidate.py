"""Persisted history of every candidate the sourcer has ever proposed.

Created with status='pending' as soon as a /sourcer/run completes; transitions
to 'validated' (when the user accepts and we create the Entreprise + Prospect)
or 'refused'. Refused entries stay so we don't re-propose them and the user
can review past runs.
"""
import secrets
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _short_id() -> str:
    return secrets.token_hex(4)


class SourcedCandidate(Base):
    __tablename__ = "sourced_candidates"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default=_short_id)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", index=True
    )

    segment_id: Mapped[str | None] = mapped_column(
        String(16),
        ForeignKey("segments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    instruction: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Snapshot of the ProposedEntreprise (entreprise, ville, signaux, sources,
    # contacts, fieldSources…) — everything needed to render the card without
    # re-querying Gemini.
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    main_contact_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    # Set on validation — points to the created entreprise / main prospect.
    entreprise_id: Mapped[str | None] = mapped_column(
        String(16),
        ForeignKey("entreprises.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    prospect_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("prospects.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    segment = relationship("Segment", lazy="noload")
