"""segments.ai_sources — per-segment web sources hint for the AI

Revision ID: 0019_segment_ai_sources
Revises: 0018_sourced_candidates
Create Date: 2026-05-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0019_segment_ai_sources"
down_revision = "0018_sourced_candidates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "segments",
        sa.Column(
            "ai_sources",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("segments", "ai_sources")
