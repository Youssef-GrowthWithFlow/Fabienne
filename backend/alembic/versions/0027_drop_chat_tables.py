"""drop conversations + chat_messages tables

Revision ID: 0027_drop_chat_tables
Revises: 0026_unify_signaux_on_entreprise
Create Date: 2026-05-23
"""
from __future__ import annotations

from alembic import op

revision = "0027_drop_chat_tables"
down_revision = "0026_unify_signaux_on_entreprise"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("conversations")


def downgrade() -> None:
    raise NotImplementedError("chat stack removed; no downgrade path")
