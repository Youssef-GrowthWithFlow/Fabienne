"""link comments to actions

Revision ID: 0007_comment_action_link
Revises: 0006_actions_table
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_comment_action_link"
down_revision = "0006_actions_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column("action_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "comments_action_id_fkey",
        "comments",
        "actions",
        ["action_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_comments_action_id", "comments", ["action_id"])


def downgrade() -> None:
    op.drop_index("ix_comments_action_id", table_name="comments")
    op.drop_constraint("comments_action_id_fkey", "comments", type_="foreignkey")
    op.drop_column("comments", "action_id")
