"""create sources table

Revision ID: 0010_sources
Revises: 0009_segments_signals_merge
Create Date: 2026-05-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_sources"
down_revision = "0009_segments_signals_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sources",
        sa.Column("id", sa.String(length=16), primary_key=True),
        sa.Column(
            "segment_id",
            sa.String(length=16),
            sa.ForeignKey("segments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entreprise", sa.String(), nullable=False, server_default=""),
        sa.Column("site_web", sa.String(), nullable=False, server_default=""),
        sa.Column("secteur", sa.String(), nullable=False, server_default=""),
        sa.Column("adresse", sa.String(), nullable=False, server_default=""),
        sa.Column("code_postal", sa.String(), nullable=False, server_default=""),
        sa.Column("ville", sa.String(), nullable=False, server_default=""),
        sa.Column("taille", sa.String(), nullable=False, server_default=""),
        sa.Column("ca", sa.String(), nullable=False, server_default=""),
        sa.Column("linkedin", sa.String(), nullable=False, server_default=""),
        sa.Column("email", sa.String(), nullable=False, server_default=""),
        sa.Column("telephone", sa.String(), nullable=False, server_default=""),
        sa.Column("score", sa.String(), nullable=False, server_default=""),
        sa.Column("origine", sa.String(), nullable=False, server_default=""),
        sa.Column("signaux_must", sa.Text(), nullable=False, server_default=""),
        sa.Column("signaux_should", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "signaux_red_flag", sa.Text(), nullable=False, server_default=""
        ),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_sources_segment_id", "sources", ["segment_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_sources_segment_id", table_name="sources")
    op.drop_table("sources")
