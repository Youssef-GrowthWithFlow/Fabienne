"""drop unused entreprises.ca + entreprises.score columns

Revision ID: 0028_drop_entreprise_ca_score
Revises: 0027_drop_chat_tables
Create Date: 2026-07-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0028_drop_entreprise_ca_score"
down_revision = "0027_drop_chat_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("entreprises", "ca")
    op.drop_column("entreprises", "score")


def downgrade() -> None:
    op.add_column(
        "entreprises",
        sa.Column("ca", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("score", sa.String(), nullable=False, server_default=""),
    )
