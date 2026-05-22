import secrets
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _short_id() -> str:
    return secrets.token_hex(4)


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default=_short_id)
    nom: Mapped[str] = mapped_column(String, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    taille_structure: Mapped[str] = mapped_column(String, nullable=False, default="")
    pitch: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")

    postes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    activite_ciblee: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    zone_geographique: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    pain_points: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    must_have: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    should_have: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    red_flags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    sources: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    benefices: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    preuves: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    # Bases de données externes activées pour le sourcing IA. Valeurs possibles : 'finess'.
    data_sources: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    # Sources web suggérées à l'agent IA (liste de {url, description}).
    # L'agent décide librement de s'en servir lors des recherches grounded.
    ai_sources: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
