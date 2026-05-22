"""replace sources by entreprises; prospects FK to entreprise

Revision ID: 0014_entreprises_refonte
Revises: 0013_chat_conversations
Create Date: 2026-05-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0014_entreprises_refonte"
down_revision = "0013_chat_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop the sources table outright (DB is wiped, no data to migrate)
    op.drop_index("ix_sources_segment_id", table_name="sources")
    op.drop_table("sources")

    # 2. Create the entreprises table
    op.create_table(
        "entreprises",
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
        "ix_entreprises_segment_id", "entreprises", ["segment_id"], unique=False
    )

    # 3. Reshape prospects: drop the company-level columns + the old segment FK,
    #    add entreprise_id FK. Pre-existing seed rows (from 0012) reference
    #    columns we're about to drop and would orphan without an entreprise —
    #    truncate them now. Comments + actions cascade-delete from prospects.
    op.execute("DELETE FROM prospects")
    op.drop_constraint("prospects_segment_fkey", "prospects", type_="foreignkey")
    op.drop_column("prospects", "segment")
    op.drop_column("prospects", "entreprise")
    op.drop_column("prospects", "website")
    op.drop_column("prospects", "taille")
    op.drop_column("prospects", "ca")
    op.drop_column("prospects", "origine")

    op.add_column(
        "prospects",
        sa.Column("entreprise_id", sa.String(length=16), nullable=True),
    )
    op.create_foreign_key(
        "prospects_entreprise_id_fkey",
        "prospects",
        "entreprises",
        ["entreprise_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_prospects_entreprise_id", "prospects", ["entreprise_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_prospects_entreprise_id", table_name="prospects")
    op.drop_constraint(
        "prospects_entreprise_id_fkey", "prospects", type_="foreignkey"
    )
    op.drop_column("prospects", "entreprise_id")
    op.add_column(
        "prospects",
        sa.Column("entreprise", sa.String(), nullable=False, server_default=""),
    )
    op.add_column("prospects", sa.Column("website", sa.String(), nullable=True))
    op.add_column(
        "prospects",
        sa.Column("taille", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "prospects",
        sa.Column("ca", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "prospects",
        sa.Column("origine", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "prospects", sa.Column("segment", sa.String(length=16), nullable=True)
    )
    op.create_foreign_key(
        "prospects_segment_fkey",
        "prospects",
        "segments",
        ["segment"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_index("ix_entreprises_segment_id", table_name="entreprises")
    op.drop_table("entreprises")
    # Recreating the sources table is left out of this downgrade — re-run 0010
    # manually if needed.
