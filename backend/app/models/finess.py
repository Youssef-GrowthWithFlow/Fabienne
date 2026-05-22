from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FinessEtablissement(Base):
    """Établissement sanitaire, social ou médico-social — extrait FINESS data.gouv.fr.

    Le `nofinesset` est l'identifiant national de l'établissement (clé primaire).
    Voir https://www.data.gouv.fr/fr/datasets/finess-extraction-du-fichier-des-etablissements-sanitaires-et-sociaux/.
    """

    __tablename__ = "finess_etablissements"

    nofinesset: Mapped[str] = mapped_column(String(9), primary_key=True)
    nofinessej: Mapped[str] = mapped_column(String(9), nullable=False, default="")

    rs: Mapped[str] = mapped_column(String, nullable=False, default="")
    rslongue: Mapped[str] = mapped_column(String, nullable=False, default="")

    # Adresse composée (numvoie + typvoie + voie + cpltdistrib + lieuditbp,
    # déjà concaténée lors de l'ingestion pour simplifier la requête).
    adresse: Mapped[str] = mapped_column(String, nullable=False, default="")
    commune_insee: Mapped[str] = mapped_column(String(5), nullable=False, default="")
    departement: Mapped[str] = mapped_column(String(3), nullable=False, default="")
    lib_departement: Mapped[str] = mapped_column(String, nullable=False, default="")
    # `ligneacheminement` du FINESS : CP + ville en clair.
    ligne_acheminement: Mapped[str] = mapped_column(String, nullable=False, default="")

    telephone: Mapped[str] = mapped_column(String, nullable=False, default="")
    telecopie: Mapped[str] = mapped_column(String, nullable=False, default="")

    categetab: Mapped[str] = mapped_column(String, nullable=False, default="")
    lib_categetab: Mapped[str] = mapped_column(String, nullable=False, default="")
    categagretab: Mapped[str] = mapped_column(String, nullable=False, default="")
    lib_categagretab: Mapped[str] = mapped_column(String, nullable=False, default="")

    siret: Mapped[str] = mapped_column(String, nullable=False, default="")
    codeape: Mapped[str] = mapped_column(String, nullable=False, default="")
    libelape: Mapped[str] = mapped_column(String, nullable=False, default="")

    dateouv: Mapped[date | None] = mapped_column(Date, nullable=True)
    dateautor: Mapped[date | None] = mapped_column(Date, nullable=True)
    datemaj: Mapped[date | None] = mapped_column(Date, nullable=True)

    coord_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    coord_y: Mapped[float | None] = mapped_column(Float, nullable=True)

    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_finess_departement", "departement"),
        Index("ix_finess_categetab", "categetab"),
        Index("ix_finess_codeape", "codeape"),
    )
