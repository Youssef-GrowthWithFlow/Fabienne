"""server-default comments.date to now()

Revision ID: 0008_comment_date_default
Revises: 0007_comment_action_link
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0008_comment_date_default"
down_revision = "0007_comment_action_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "comments",
        "date",
        server_default=sa.func.now(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "comments",
        "date",
        server_default=None,
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
