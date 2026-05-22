"""shorten segment ids to 8 hex chars

Revision ID: 0003_short_segment_ids
Revises: 0002_prospects
Create Date: 2026-05-14
"""
from __future__ import annotations

import secrets

import sqlalchemy as sa
from alembic import op

revision = "0003_short_segment_ids"
down_revision = "0002_prospects"
branch_labels = None
depends_on = None


# Fixed short IDs for the three seed segments, so prospect references stay stable.
SEED_REMAP = {
    "11111111-1111-1111-1111-111111111111": "pharma01",
    "22222222-2222-2222-2222-222222222222": "startup1",
    "33333333-3333-3333-3333-333333333333": "collect1",
}


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(sa.text("SELECT id FROM segments")).fetchall()
    for (old_id,) in rows:
        if len(old_id) <= 16:
            continue
        new_id = SEED_REMAP.get(old_id) or secrets.token_hex(4)
        conn.execute(
            sa.text("UPDATE prospects SET segment = :n WHERE segment = :o"),
            {"n": new_id, "o": old_id},
        )
        conn.execute(
            sa.text("UPDATE segments SET id = :n WHERE id = :o"),
            {"n": new_id, "o": old_id},
        )

    # Null out any orphaned prospect.segment refs that no longer match a segment.
    conn.execute(
        sa.text(
            "UPDATE prospects SET segment = NULL "
            "WHERE segment IS NOT NULL "
            "AND segment NOT IN (SELECT id FROM segments)"
        )
    )

    op.alter_column(
        "segments",
        "id",
        existing_type=sa.String(length=36),
        type_=sa.String(length=16),
    )
    op.alter_column(
        "prospects",
        "segment",
        existing_type=sa.String(length=36),
        type_=sa.String(length=16),
    )


def downgrade() -> None:
    op.alter_column(
        "prospects",
        "segment",
        existing_type=sa.String(length=16),
        type_=sa.String(length=36),
    )
    op.alter_column(
        "segments",
        "id",
        existing_type=sa.String(length=16),
        type_=sa.String(length=36),
    )
