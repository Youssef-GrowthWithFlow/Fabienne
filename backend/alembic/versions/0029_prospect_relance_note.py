"""add prospects.relance_note — what to do at the next follow-up

Revision ID: 0029_prospect_relance_note
Revises: 0028_drop_entreprise_ca_score
Create Date: 2026-07-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0029_prospect_relance_note"
down_revision = "0028_drop_entreprise_ca_score"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospects",
        sa.Column("relance_note", sa.String(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("prospects", "relance_note")
