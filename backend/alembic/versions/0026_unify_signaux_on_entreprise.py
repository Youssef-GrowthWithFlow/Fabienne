"""unify signaux on entreprise (single JSON list, drop legacy text columns)

Replaces three never-properly-populated text columns on `entreprises`
(signaux_must, signaux_should, signaux_red_flag) with a single `signaux`
JSON list aligned with what the sourcer produces (flat list of short tags
displayed as badges in the UI). Also drops the prospect-side mirror
(indicateurs_cles / infos_utiles / signaux_alerte) — those signals belong
to the entreprise and are now consumed via the entreprise relation on
the prospect.

No backfill: the dropped text columns were rarely populated and the
project is still in build phase.

Revision ID: 0026_unify_signaux_on_entreprise
Revises: 0025_move_fiche_to_entreprise
Create Date: 2026-05-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026_unify_signaux_on_entreprise"
down_revision = "0025_move_fiche_to_entreprise"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entreprises",
        sa.Column(
            "signaux",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.drop_column("entreprises", "signaux_must")
    op.drop_column("entreprises", "signaux_should")
    op.drop_column("entreprises", "signaux_red_flag")
    op.drop_column("prospects", "indicateurs_cles")
    op.drop_column("prospects", "infos_utiles")
    op.drop_column("prospects", "signaux_alerte")


def downgrade() -> None:
    op.add_column(
        "prospects",
        sa.Column("signaux_alerte", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "prospects",
        sa.Column("infos_utiles", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "prospects",
        sa.Column("indicateurs_cles", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("signaux_red_flag", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("signaux_should", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "entreprises",
        sa.Column("signaux_must", sa.Text(), nullable=False, server_default=""),
    )
    op.drop_column("entreprises", "signaux")
