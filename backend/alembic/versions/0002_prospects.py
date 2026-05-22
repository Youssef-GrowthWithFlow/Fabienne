"""create prospects table and seed initial prospects

Revision ID: 0002_prospects
Revises: 0001_segments
Create Date: 2026-05-14
"""
from __future__ import annotations

from datetime import date

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002_prospects"
down_revision = "0001_segments"
branch_labels = None
depends_on = None


FICHE = (
    "<h2>Contexte / Découverte</h2>\n<p></p>\n"
    "<h2>Besoins / Pain points</h2>\n<p></p>\n"
    "<h2>Décideurs & parties prenantes</h2>\n<p></p>\n"
    "<h2>Historique & prochaines étapes</h2>\n<p></p>"
)

SEG_PHARMACIE = "11111111-1111-1111-1111-111111111111"
SEG_STARTUP = "22222222-2222-2222-2222-222222222222"
SEG_COLLECTIVITE = "33333333-3333-3333-3333-333333333333"


def upgrade() -> None:
    prospects = op.create_table(
        "prospects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("nom", sa.String(), nullable=False, server_default=""),
        sa.Column("entreprise", sa.String(), nullable=False, server_default=""),
        sa.Column("role", sa.String(), nullable=False, server_default=""),
        sa.Column("segment", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="À contacter"),
        sa.Column("email", sa.String(), nullable=False, server_default=""),
        sa.Column("telephone", sa.String(), nullable=False, server_default=""),
        sa.Column("linkedin", sa.String(), nullable=True),
        sa.Column("website", sa.String(), nullable=True),
        sa.Column("fiche_client", sa.Text(), nullable=False, server_default=""),
        sa.Column("comments", JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.Date(), nullable=False),
        sa.Column("contacted_at", sa.Date(), nullable=True),
        sa.Column("relance_date", sa.Date(), nullable=True),
    )

    op.bulk_insert(
        prospects,
        [
            {
                "id": "p-seed-1",
                "nom": "Emilie Genieys",
                "entreprise": "Pharmacie Genieys",
                "role": "Pharmacien titulaire",
                "segment": SEG_PHARMACIE,
                "status": "À contacter",
                "email": "pharmacie.gratentour@gmail.com",
                "telephone": "05 61 82 37 64",
                "linkedin": None,
                "website": None,
                "fiche_client": FICHE,
                "comments": [
                    {
                        "id": "c1",
                        "date": "2026-05-13",
                        "texte": "Reprise très récente (avril 2026)",
                    }
                ],
                "created_at": date(2026, 5, 12),
                "contacted_at": None,
                "relance_date": date(2026, 5, 16),
            },
            {
                "id": "p-seed-2",
                "nom": "Julien Marchand",
                "entreprise": "Startup Nimbus",
                "role": "CEO",
                "segment": SEG_STARTUP,
                "status": "Contacté",
                "email": "julien@nimbus.io",
                "telephone": "06 12 34 56 78",
                "linkedin": "https://linkedin.com/in/julienmarchand",
                "website": "https://nimbus.io",
                "fiche_client": FICHE,
                "comments": [
                    {
                        "id": "c2",
                        "date": "2026-05-12",
                        "texte": "Premier email envoyé, attente retour",
                    }
                ],
                "created_at": date(2026, 5, 11),
                "contacted_at": date(2026, 5, 12),
                "relance_date": date(2026, 5, 14),
            },
            {
                "id": "p-seed-3",
                "nom": "Sophie Dubois",
                "entreprise": "Mairie de Saint-Jean",
                "role": "Responsable achats",
                "segment": SEG_COLLECTIVITE,
                "status": "Sans réponse",
                "email": "sophie.dubois@stjean.fr",
                "telephone": "05 34 12 78 90",
                "linkedin": None,
                "website": None,
                "fiche_client": FICHE,
                "comments": [
                    {"id": "c3", "date": "2026-05-02", "texte": "Relance 1 envoyée"}
                ],
                "created_at": date(2026, 4, 20),
                "contacted_at": date(2026, 4, 25),
                "relance_date": date(2026, 5, 10),
            },
            {
                "id": "p-seed-5",
                "nom": "Anaïs Lefèvre",
                "entreprise": "Pharmacie de la Place",
                "role": "Pharmacien titulaire",
                "segment": SEG_PHARMACIE,
                "status": "RDV",
                "email": "a.lefevre@pharm-place.fr",
                "telephone": "04 22 11 33 44",
                "linkedin": None,
                "website": None,
                "fiche_client": FICHE,
                "comments": [
                    {
                        "id": "c5",
                        "date": "2026-05-09",
                        "texte": "RDV confirmé pour le 22 mai",
                    }
                ],
                "created_at": date(2026, 4, 15),
                "contacted_at": date(2026, 4, 18),
                "relance_date": None,
            },
            {
                "id": "p-seed-6",
                "nom": "Thomas Renaud",
                "entreprise": "CleanCity SaaS",
                "role": "COO",
                "segment": SEG_STARTUP,
                "status": "Client",
                "email": "thomas@cleancity.io",
                "telephone": "06 99 88 77 66",
                "linkedin": "https://linkedin.com/in/thomasrenaud",
                "website": "https://cleancity.io",
                "fiche_client": FICHE,
                "comments": [
                    {"id": "c6", "date": "2026-05-05", "texte": "Contrat signé"}
                ],
                "created_at": date(2026, 3, 20),
                "contacted_at": date(2026, 3, 22),
                "relance_date": None,
            },
            {
                "id": "p-seed-7",
                "nom": "Léa Marin",
                "entreprise": "Mairie de Frouzins",
                "role": "DGS",
                "segment": SEG_COLLECTIVITE,
                "status": "Répondu",
                "email": "lea.marin@frouzins.fr",
                "telephone": "05 61 78 90 12",
                "linkedin": None,
                "website": None,
                "fiche_client": FICHE,
                "comments": [
                    {
                        "id": "c7",
                        "date": "2026-05-12",
                        "texte": "Intéressée, attend devis",
                    }
                ],
                "created_at": date(2026, 5, 4),
                "contacted_at": date(2026, 5, 6),
                "relance_date": date(2026, 5, 19),
            },
            {
                "id": "p-seed-4",
                "nom": "Karim Belkacem",
                "entreprise": "Pharmacie du Centre",
                "role": "Pharmacien titulaire",
                "segment": SEG_PHARMACIE,
                "status": "En discussion",
                "email": "k.belkacem@pharmacie-centre.fr",
                "telephone": "04 56 78 90 12",
                "linkedin": None,
                "website": None,
                "fiche_client": FICHE,
                "comments": [],
                "created_at": date(2026, 5, 13),
                "contacted_at": date(2026, 5, 13),
                "relance_date": date(2026, 5, 20),
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("prospects")
