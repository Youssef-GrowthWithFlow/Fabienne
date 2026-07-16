"""enrichment lifecycle + entreprise email

- entreprises.fiche_status : none → generating → ready | error. Drives the
  live loader shown while the background fiche generation runs.
- entreprises.email : generic company inbox (contact@, info@…) — distinct
  from the prospect's personal email.
- prospects.enrichment_status : none → generating → ready | error. Drives
  the loader shown on the contact's coordonnées while DropContact + the
  online lookup run.

Revision ID: 0030_enrichment_status
Revises: 0029_prospect_relance_note
Create Date: 2026-07-16
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0030_enrichment_status"
down_revision = "0029_prospect_relance_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entreprises",
        sa.Column("fiche_status", sa.String(), nullable=False, server_default="none"),
    )
    op.add_column(
        "entreprises",
        sa.Column("email", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "prospects",
        sa.Column(
            "enrichment_status", sa.String(), nullable=False, server_default="none"
        ),
    )
    # Existing fiches were generated successfully.
    op.execute("UPDATE entreprises SET fiche_status = 'ready' WHERE fiche_client != ''")


def downgrade() -> None:
    op.drop_column("prospects", "enrichment_status")
    op.drop_column("entreprises", "email")
    op.drop_column("entreprises", "fiche_status")
