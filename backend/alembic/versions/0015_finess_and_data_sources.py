"""add finess_etablissements table + segments.data_sources

Revision ID: 0015_finess_and_data_sources
Revises: 0014_entreprises_refonte
Create Date: 2026-05-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0015_finess_and_data_sources"
down_revision = "0014_entreprises_refonte"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Segments — opt-in external data sources.
    op.add_column(
        "segments",
        sa.Column(
            "data_sources",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
    )

    # 2. FINESS dump — one row per établissement, after dewrangling
    # structureet + geolocalisation lines from the data.gouv.fr CSV.
    op.create_table(
        "finess_etablissements",
        sa.Column("nofinesset", sa.String(length=9), primary_key=True),
        sa.Column("nofinessej", sa.String(length=9), nullable=False, server_default=""),
        sa.Column("rs", sa.String(), nullable=False, server_default=""),
        sa.Column("rslongue", sa.String(), nullable=False, server_default=""),
        sa.Column("adresse", sa.String(), nullable=False, server_default=""),
        sa.Column("commune_insee", sa.String(length=5), nullable=False, server_default=""),
        sa.Column("departement", sa.String(length=3), nullable=False, server_default=""),
        sa.Column("lib_departement", sa.String(), nullable=False, server_default=""),
        sa.Column("ligne_acheminement", sa.String(), nullable=False, server_default=""),
        sa.Column("telephone", sa.String(), nullable=False, server_default=""),
        sa.Column("telecopie", sa.String(), nullable=False, server_default=""),
        sa.Column("categetab", sa.String(), nullable=False, server_default=""),
        sa.Column("lib_categetab", sa.String(), nullable=False, server_default=""),
        sa.Column("categagretab", sa.String(), nullable=False, server_default=""),
        sa.Column("lib_categagretab", sa.String(), nullable=False, server_default=""),
        sa.Column("siret", sa.String(), nullable=False, server_default=""),
        sa.Column("codeape", sa.String(), nullable=False, server_default=""),
        sa.Column("libelape", sa.String(), nullable=False, server_default=""),
        sa.Column("dateouv", sa.Date(), nullable=True),
        sa.Column("dateautor", sa.Date(), nullable=True),
        sa.Column("datemaj", sa.Date(), nullable=True),
        sa.Column("coord_x", sa.Float(), nullable=True),
        sa.Column("coord_y", sa.Float(), nullable=True),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_finess_departement", "finess_etablissements", ["departement"], unique=False
    )
    op.create_index(
        "ix_finess_categetab", "finess_etablissements", ["categetab"], unique=False
    )
    op.create_index(
        "ix_finess_codeape", "finess_etablissements", ["codeape"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_finess_codeape", table_name="finess_etablissements")
    op.drop_index("ix_finess_categetab", table_name="finess_etablissements")
    op.drop_index("ix_finess_departement", table_name="finess_etablissements")
    op.drop_table("finess_etablissements")
    op.drop_column("segments", "data_sources")
