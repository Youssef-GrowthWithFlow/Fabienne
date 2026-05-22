"""add google places columns to entreprises (phone, hours, rating, gps, place_id)

Revision ID: 0021_entreprise_google_places
Revises: 0020_ordre_annuaire
Create Date: 2026-05-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_entreprise_google_places"
down_revision = "0020_ordre_annuaire"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entreprises",
        sa.Column("telephone", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("horaires_text", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("google_place_id", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("google_maps_url", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("google_rating", sa.Float(), nullable=True),
    )
    op.add_column(
        "entreprises",
        sa.Column("google_rating_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "entreprises",
        sa.Column("latitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "entreprises",
        sa.Column("longitude", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("entreprises", "longitude")
    op.drop_column("entreprises", "latitude")
    op.drop_column("entreprises", "google_rating_count")
    op.drop_column("entreprises", "google_rating")
    op.drop_column("entreprises", "google_maps_url")
    op.drop_column("entreprises", "google_place_id")
    op.drop_column("entreprises", "horaires_text")
    op.drop_column("entreprises", "telephone")
