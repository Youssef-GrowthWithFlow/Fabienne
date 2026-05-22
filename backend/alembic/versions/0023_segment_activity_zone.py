"""replace segments.sous_secteur (string) with activite_ciblee + zone_geographique (arrays)

Revision ID: 0023_segment_activity_zone
Revises: 0022_drop_horaires_text
Create Date: 2026-05-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0023_segment_activity_zone"
down_revision = "0022_drop_horaires_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Two new array fields replace the previous single string. Existing
    # segments lose their sous_secteur content — project is in build phase,
    # users will re-fill the criteria via the segment sheet.
    op.add_column(
        "segments",
        sa.Column(
            "activite_ciblee",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column(
        "segments",
        sa.Column(
            "zone_geographique",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.drop_column("segments", "sous_secteur")


def downgrade() -> None:
    op.add_column(
        "segments",
        sa.Column(
            "sous_secteur",
            sa.String(),
            nullable=False,
            server_default="",
        ),
    )
    op.drop_column("segments", "zone_geographique")
    op.drop_column("segments", "activite_ciblee")
