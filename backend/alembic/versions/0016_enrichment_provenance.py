"""add API gouv fields + per-field provenance tracking

Revision ID: 0016_enrichment_provenance
Revises: 0015_finess_and_data_sources
Create Date: 2026-05-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016_enrichment_provenance"
down_revision = "0015_finess_and_data_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Entreprises — structured identity from recherche-entreprises.api.gouv.fr
    op.add_column(
        "entreprises", sa.Column("siren", sa.String(length=9), nullable=True)
    )
    op.add_column(
        "entreprises", sa.Column("siret", sa.String(length=14), nullable=True)
    )
    op.add_column(
        "entreprises", sa.Column("naf_code", sa.String(length=8), nullable=True)
    )
    op.add_column(
        "entreprises", sa.Column("naf_label", sa.String(), nullable=True)
    )
    op.add_column(
        "entreprises", sa.Column("effectif", sa.String(), nullable=True)
    )
    op.add_column(
        "entreprises", sa.Column("date_creation", sa.Date(), nullable=True)
    )
    op.add_column(
        "entreprises",
        sa.Column(
            "dirigeants",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column(
        "entreprises",
        sa.Column(
            "field_sources",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )
    op.create_index(
        "ix_entreprises_siren", "entreprises", ["siren"], unique=False
    )
    op.create_index(
        "ix_entreprises_siret", "entreprises", ["siret"], unique=False
    )

    # Prospects — per-field provenance only (no API-derived columns).
    op.add_column(
        "prospects",
        sa.Column(
            "field_sources",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )


def downgrade() -> None:
    op.drop_column("prospects", "field_sources")
    op.drop_index("ix_entreprises_siret", table_name="entreprises")
    op.drop_index("ix_entreprises_siren", table_name="entreprises")
    op.drop_column("entreprises", "field_sources")
    op.drop_column("entreprises", "dirigeants")
    op.drop_column("entreprises", "date_creation")
    op.drop_column("entreprises", "effectif")
    op.drop_column("entreprises", "naf_label")
    op.drop_column("entreprises", "naf_code")
    op.drop_column("entreprises", "siret")
    op.drop_column("entreprises", "siren")
