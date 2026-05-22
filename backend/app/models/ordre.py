"""Annuaire de l'Ordre National des Pharmaciens — extraits CSV officiels.

Trois tables miroir des trois fichiers CSV utiles ingérés par
``app.scripts.ingest_ordre`` :

- ``ordre_etablissements`` : un établissement = officine, PUI, multi-employeur…
  identifié par un hash hexa 32 caractères (``numero_etablissement``).
- ``ordre_pharmaciens`` : personnes physiques inscrites à l'Ordre, identifiées
  par leur n° RPPS.
- ``ordre_activites`` : table de jointure ``pharmacien ↔ établissement`` avec
  la fonction exercée (Titulaire, Adjoint, Adjoint temps partiel…) et la date
  d'inscription. Un pharmacien peut exercer dans plusieurs établissements,
  un établissement compte plusieurs pharmaciens.

Re-ingestion : destructive (TRUNCATE + COPY-like INSERT batch). Voir le script.
"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class OrdreEtablissement(Base):
    __tablename__ = "ordre_etablissements"

    # Hash hexa 32 chars dans le CSV de l'Ordre — pas de SIRET ni de FINESS.
    numero_etablissement: Mapped[str] = mapped_column(String(64), primary_key=True)

    type_etablissement: Mapped[str] = mapped_column(String, nullable=False, default="")
    denomination_commerciale: Mapped[str] = mapped_column(String, nullable=False, default="")
    raison_sociale: Mapped[str] = mapped_column(String, nullable=False, default="")
    adresse: Mapped[str] = mapped_column(String, nullable=False, default="")
    code_postal: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    commune: Mapped[str] = mapped_column(String, nullable=False, default="")
    departement: Mapped[str] = mapped_column(String, nullable=False, default="")
    region: Mapped[str] = mapped_column(String, nullable=False, default="")
    telephone: Mapped[str] = mapped_column(String, nullable=False, default="")
    fax: Mapped[str] = mapped_column(String, nullable=False, default="")

    # Forme normalisée pour fuzzy-match avec un nom d'entreprise candidat :
    # raison sociale + dénomination concaténées et normalisées (lower, sans
    # accents, sans ponctuation). Indexée pour ILIKE / égalité rapide.
    nom_normalise: Mapped[str] = mapped_column(String, nullable=False, default="")

    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_ordre_etab_code_postal", "code_postal"),
        Index("ix_ordre_etab_commune", "commune"),
        Index("ix_ordre_etab_type", "type_etablissement"),
        Index("ix_ordre_etab_nom_normalise", "nom_normalise"),
    )


class OrdrePharmacien(Base):
    __tablename__ = "ordre_pharmaciens"

    rpps: Mapped[str] = mapped_column(String(15), primary_key=True)
    titre: Mapped[str] = mapped_column(String, nullable=False, default="")
    nom_exercice: Mapped[str] = mapped_column(String, nullable=False, default="")
    prenom: Mapped[str] = mapped_column(String, nullable=False, default="")
    date_premiere_inscription: Mapped[date | None] = mapped_column(Date, nullable=True)

    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class OrdreActivite(Base):
    """Pharmacien × Établissement × Fonction.

    Pas de FK contraintes — l'ingestion truncate les 3 tables avant chaque
    réimport, donc on ne peut pas garantir l'ordre. La jointure se fait par
    ``rpps`` et ``numero_etablissement`` via le service de lookup.
    """

    __tablename__ = "ordre_activites"

    # Composite key : un même pharmacien peut avoir plusieurs fonctions dans
    # le même établissement (rare mais existe).
    rpps: Mapped[str] = mapped_column(String(15), primary_key=True)
    numero_etablissement: Mapped[str] = mapped_column(String(64), primary_key=True)
    fonction: Mapped[str] = mapped_column(String, primary_key=True)

    date_inscription: Mapped[date | None] = mapped_column(Date, nullable=True)
    section: Mapped[str] = mapped_column(String(2), nullable=False, default="")
    # 'O'/'N' dans le CSV (activité principale Oui/Non).
    activite_principale: Mapped[str] = mapped_column(String(1), nullable=False, default="")

    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_ordre_act_etab", "numero_etablissement"),
        Index("ix_ordre_act_rpps", "rpps"),
    )
