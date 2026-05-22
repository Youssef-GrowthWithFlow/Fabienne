"""create actions table

Revision ID: 0006_actions_table
Revises: 0005_comments_table
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006_actions_table"
down_revision = "0005_comments_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "actions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "prospect_id",
            sa.String(length=36),
            sa.ForeignKey("prospects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column(
            "at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("metadata", JSONB(), nullable=True),
    )
    op.create_index("ix_actions_prospect_id", "actions", ["prospect_id"])
    op.create_index("ix_actions_prospect_at", "actions", ["prospect_id", "at"])
    op.create_index("ix_actions_at", "actions", ["at"])


def downgrade() -> None:
    op.drop_index("ix_actions_at", table_name="actions")
    op.drop_index("ix_actions_prospect_at", table_name="actions")
    op.drop_index("ix_actions_prospect_id", table_name="actions")
    op.drop_table("actions")
