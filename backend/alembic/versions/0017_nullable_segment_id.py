"""allow entreprises without a segment

Revision ID: 0017_nullable_segment_id
Revises: 0016_enrichment_provenance
Create Date: 2026-05-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017_nullable_segment_id"
down_revision = "0016_enrichment_provenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "entreprises", "segment_id", existing_type=sa.String(length=16), nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "entreprises", "segment_id", existing_type=sa.String(length=16), nullable=False
    )
