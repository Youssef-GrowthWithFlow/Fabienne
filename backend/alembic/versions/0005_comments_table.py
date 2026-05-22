"""create comments table, drop JSONB column

Revision ID: 0005_comments_table
Revises: 0004_prospect_segment_fk
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_comments_table"
down_revision = "0004_prospect_segment_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("prospects", "comments")

    op.create_table(
        "comments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "prospect_id",
            sa.String(length=36),
            sa.ForeignKey("prospects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("texte", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_comments_prospect_id", "comments", ["prospect_id"])


def downgrade() -> None:
    op.drop_index("ix_comments_prospect_id", table_name="comments")
    op.drop_table("comments")
    op.add_column(
        "prospects",
        sa.Column("comments", sa.dialects.postgresql.JSONB(), nullable=False, server_default="[]"),
    )
