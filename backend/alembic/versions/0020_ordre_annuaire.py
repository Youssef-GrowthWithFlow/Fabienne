"""add ordre annuaire tables (etablissements / pharmaciens / activites)

Revision ID: 0020_ordre_annuaire
Revises: 0019_segment_ai_sources
Create Date: 2026-05-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020_ordre_annuaire"
down_revision = "0019_segment_ai_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ordre_etablissements",
        sa.Column("numero_etablissement", sa.String(length=64), primary_key=True),
        sa.Column("type_etablissement", sa.String(), nullable=False, server_default=""),
        sa.Column("denomination_commerciale", sa.String(), nullable=False, server_default=""),
        sa.Column("raison_sociale", sa.String(), nullable=False, server_default=""),
        sa.Column("adresse", sa.String(), nullable=False, server_default=""),
        sa.Column("code_postal", sa.String(length=10), nullable=False, server_default=""),
        sa.Column("commune", sa.String(), nullable=False, server_default=""),
        sa.Column("departement", sa.String(), nullable=False, server_default=""),
        sa.Column("region", sa.String(), nullable=False, server_default=""),
        sa.Column("telephone", sa.String(), nullable=False, server_default=""),
        sa.Column("fax", sa.String(), nullable=False, server_default=""),
        sa.Column("nom_normalise", sa.String(), nullable=False, server_default=""),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ordre_etab_code_postal", "ordre_etablissements", ["code_postal"])
    op.create_index("ix_ordre_etab_commune", "ordre_etablissements", ["commune"])
    op.create_index("ix_ordre_etab_type", "ordre_etablissements", ["type_etablissement"])
    op.create_index("ix_ordre_etab_nom_normalise", "ordre_etablissements", ["nom_normalise"])

    op.create_table(
        "ordre_pharmaciens",
        sa.Column("rpps", sa.String(length=15), primary_key=True),
        sa.Column("titre", sa.String(), nullable=False, server_default=""),
        sa.Column("nom_exercice", sa.String(), nullable=False, server_default=""),
        sa.Column("prenom", sa.String(), nullable=False, server_default=""),
        sa.Column("date_premiere_inscription", sa.Date(), nullable=True),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "ordre_activites",
        sa.Column("rpps", sa.String(length=15), primary_key=True),
        sa.Column("numero_etablissement", sa.String(length=64), primary_key=True),
        sa.Column("fonction", sa.String(), primary_key=True),
        sa.Column("date_inscription", sa.Date(), nullable=True),
        sa.Column("section", sa.String(length=2), nullable=False, server_default=""),
        sa.Column("activite_principale", sa.String(length=1), nullable=False, server_default=""),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ordre_act_etab", "ordre_activites", ["numero_etablissement"])
    op.create_index("ix_ordre_act_rpps", "ordre_activites", ["rpps"])


def downgrade() -> None:
    op.drop_index("ix_ordre_act_rpps", table_name="ordre_activites")
    op.drop_index("ix_ordre_act_etab", table_name="ordre_activites")
    op.drop_table("ordre_activites")
    op.drop_table("ordre_pharmaciens")
    op.drop_index("ix_ordre_etab_nom_normalise", table_name="ordre_etablissements")
    op.drop_index("ix_ordre_etab_type", table_name="ordre_etablissements")
    op.drop_index("ix_ordre_etab_commune", table_name="ordre_etablissements")
    op.drop_index("ix_ordre_etab_code_postal", table_name="ordre_etablissements")
    op.drop_table("ordre_etablissements")
