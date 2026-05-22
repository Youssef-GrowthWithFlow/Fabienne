"""merge segment triggers into must_have, rename nice_to_have to should_have

Revision ID: 0009_segments_signals_merge
Revises: 0008_comment_date_default
Create Date: 2026-05-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0009_segments_signals_merge"
down_revision = "0008_comment_date_default"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE segments SET must_have = must_have || triggers WHERE triggers IS NOT NULL"
    )
    op.drop_column("segments", "triggers")
    op.alter_column("segments", "nice_to_have", new_column_name="should_have")


def downgrade() -> None:
    op.alter_column("segments", "should_have", new_column_name="nice_to_have")
    op.add_column(
        "segments",
        sa.Column(
            "triggers",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
    )
