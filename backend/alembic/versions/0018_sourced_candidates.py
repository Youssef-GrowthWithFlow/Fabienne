"""sourced_candidates table — persisted sourcing history

Revision ID: 0018_sourced_candidates
Revises: 0017_nullable_segment_id
Create Date: 2026-05-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0018_sourced_candidates"
down_revision = "0017_nullable_segment_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sourced_candidates",
        sa.Column("id", sa.String(length=16), primary_key=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "segment_id",
            sa.String(length=16),
            sa.ForeignKey("segments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("instruction", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "payload",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
        sa.Column(
            "main_contact_index",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "entreprise_id",
            sa.String(length=16),
            sa.ForeignKey("entreprises.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "prospect_id",
            sa.String(length=36),
            sa.ForeignKey("prospects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_sourced_candidates_status", "sourced_candidates", ["status"]
    )
    op.create_index(
        "ix_sourced_candidates_segment_id",
        "sourced_candidates",
        ["segment_id"],
    )
    op.create_index(
        "ix_sourced_candidates_entreprise_id",
        "sourced_candidates",
        ["entreprise_id"],
    )
    op.create_index(
        "ix_sourced_candidates_created_at",
        "sourced_candidates",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sourced_candidates_created_at", table_name="sourced_candidates"
    )
    op.drop_index(
        "ix_sourced_candidates_entreprise_id", table_name="sourced_candidates"
    )
    op.drop_index(
        "ix_sourced_candidates_segment_id", table_name="sourced_candidates"
    )
    op.drop_index(
        "ix_sourced_candidates_status", table_name="sourced_candidates"
    )
    op.drop_table("sourced_candidates")
