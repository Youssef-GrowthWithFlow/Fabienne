"""add contact fields on sources and qualification fields on prospects

Revision ID: 0011_contact_signals
Revises: 0010_sources
Create Date: 2026-05-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_contact_signals"
down_revision = "0010_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sources: contact identity
    op.add_column(
        "sources",
        sa.Column(
            "nom_contact", sa.String(), nullable=False, server_default=""
        ),
    )
    op.add_column(
        "sources",
        sa.Column(
            "role_contact", sa.String(), nullable=False, server_default=""
        ),
    )

    # Prospects: qualification fields carried over from a source
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
        "prospects",
        sa.Column(
            "indicateurs_cles", sa.Text(), nullable=False, server_default=""
        ),
    )
    op.add_column(
        "prospects",
        sa.Column(
            "infos_utiles", sa.Text(), nullable=False, server_default=""
        ),
    )
    op.add_column(
        "prospects",
        sa.Column(
            "signaux_alerte", sa.Text(), nullable=False, server_default=""
        ),
    )


def downgrade() -> None:
    op.drop_column("prospects", "signaux_alerte")
    op.drop_column("prospects", "infos_utiles")
    op.drop_column("prospects", "indicateurs_cles")
    op.drop_column("prospects", "origine")
    op.drop_column("prospects", "ca")
    op.drop_column("prospects", "taille")
    op.drop_column("sources", "role_contact")
    op.drop_column("sources", "nom_contact")
