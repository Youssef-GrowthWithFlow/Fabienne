"""move fiche_client column from prospects to entreprises

The fiche client (Gemini-generated HTML) is conceptually a property of the
entreprise (its activity, signals, commercial approach), not of an individual
contact. Multiple prospects within the same entreprise should share a single
fiche. Generation now triggers on candidate validation; the column on the
prospects table is dropped without backfill (project still in build phase).

Revision ID: 0025_move_fiche_to_entreprise
Revises: 0024_users
Create Date: 2026-05-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025_move_fiche_to_entreprise"
down_revision = "0024_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entreprises",
        sa.Column("fiche_client", sa.Text(), nullable=False, server_default=""),
    )
    op.drop_column("prospects", "fiche_client")


def downgrade() -> None:
    op.add_column(
        "prospects",
        sa.Column("fiche_client", sa.Text(), nullable=False, server_default=""),
    )
    op.drop_column("entreprises", "fiche_client")
