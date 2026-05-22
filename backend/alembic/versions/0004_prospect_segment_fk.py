"""add FK on prospects.segment with ON DELETE SET NULL

Revision ID: 0004_prospect_segment_fk
Revises: 0003_short_segment_ids
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_prospect_segment_fk"
down_revision = "0003_short_segment_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Clean up any orphaned segment references before adding the FK.
    op.execute(
        "UPDATE prospects SET segment = NULL "
        "WHERE segment IS NOT NULL "
        "AND segment NOT IN (SELECT id FROM segments)"
    )
    op.create_foreign_key(
        "prospects_segment_fkey",
        "prospects",
        "segments",
        ["segment"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("prospects_segment_fkey", "prospects", type_="foreignkey")
