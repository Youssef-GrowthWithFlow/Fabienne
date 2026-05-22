"""drop entreprises.horaires_text (Google Places hours dropped from product scope)

Revision ID: 0022_drop_horaires_text
Revises: 0021_entreprise_google_places
Create Date: 2026-05-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_drop_horaires_text"
down_revision = "0021_entreprise_google_places"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("entreprises", "horaires_text")


def downgrade() -> None:
    op.add_column(
        "entreprises",
        sa.Column("horaires_text", sa.Text(), nullable=False, server_default=""),
    )
