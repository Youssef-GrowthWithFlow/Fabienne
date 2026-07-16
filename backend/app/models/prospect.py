import uuid
from datetime import date

from sqlalchemy import JSON, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.action import Action
from app.models.comment import Comment
from app.models.entreprise import Entreprise


def _uuid() -> str:
    return str(uuid.uuid4())


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nom: Mapped[str] = mapped_column(String, nullable=False, default="")
    role: Mapped[str] = mapped_column(String, nullable=False, default="")
    entreprise_id: Mapped[str | None] = mapped_column(
        String(16),
        ForeignKey("entreprises.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="À contacter")
    email: Mapped[str] = mapped_column(String, nullable=False, default="")
    telephone: Mapped[str] = mapped_column(String, nullable=False, default="")
    linkedin: Mapped[str | None] = mapped_column(String, nullable=True)
    field_sources: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[date] = mapped_column(Date, nullable=False)
    contacted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    relance_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # What to do at the next follow-up, in the user's words
    # (« envoyer ma proposition de projet »). Shown as the task sentence.
    relance_note: Mapped[str] = mapped_column(String, nullable=False, default="")
    # Personal-info enrichment lifecycle: "none" | "generating" | "ready" |
    # "error". Drives the loader on the contact's coordonnées while the
    # online lookup + DropContact run after validation.
    enrichment_status: Mapped[str] = mapped_column(
        String, nullable=False, default="none"
    )

    entreprise: Mapped[Entreprise | None] = relationship(
        Entreprise,
        back_populates="contacts",
        lazy="selectin",
    )

    comments: Mapped[list[Comment]] = relationship(
        Comment,
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by=Comment.date.desc(),
    )
    actions: Mapped[list[Action]] = relationship(
        Action,
        cascade="all, delete-orphan",
        lazy="noload",
        order_by=Action.at.desc(),
    )
