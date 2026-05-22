"""create segments table and seed initial briefs

Revision ID: 0001_segments
Revises:
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0001_segments"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    segments = op.create_table(
        "segments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("nom", sa.String(), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("taille_structure", sa.String(), nullable=False, server_default=""),
        sa.Column("sous_secteur", sa.String(), nullable=False, server_default=""),
        sa.Column("pitch", sa.Text(), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("postes", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("triggers", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("pain_points", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("must_have", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("nice_to_have", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("red_flags", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("sources", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("benefices", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("preuves", ARRAY(sa.String()), nullable=False, server_default="{}"),
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

    op.bulk_insert(
        segments,
        [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "nom": "Pharmacie de quartier",
                "description": "Officines indépendantes en France qui veulent fidéliser leur patientèle et résister aux chaînes.",
                "taille_structure": "2 à 8 salariés",
                "sous_secteur": "Officines indépendantes en France",
                "pitch": "J’accompagne les titulaires et leurs équipes à traverser les transitions (reprise, recomposition) en gardant le collectif soudé.",
                "notes": "",
                "postes": ["Pharmacien titulaire", "Pharmacien adjoint"],
                "triggers": [
                    "Vient de reprendre l’officine",
                    "Lance un programme de fidélité",
                    "Ouvre un service click & collect",
                ],
                "pain_points": [
                    "Patientèle qui s’érode",
                    "Pas le temps de communiquer",
                    "Concurrence des chaînes et du e-commerce",
                ],
                "must_have": ["Officine indépendante", "Décideur joignable"],
                "nice_to_have": [
                    "Présence sur les réseaux sociaux",
                    "Équipe déjà digitalisée",
                ],
                "red_flags": [
                    "Rachat par un groupe en cours",
                    "Procédure de liquidation",
                ],
                "sources": [
                    "LeMoniteurDesPharmacies.fr",
                    "Ordre des pharmaciens",
                    "Pappers",
                    "Pages Jaunes",
                ],
                "benefices": [
                    "Équipe réalignée sur un cap commun",
                    "Posture du titulaire clarifiée",
                    "Climat de travail apaisé",
                ],
                "preuves": [
                    "Approche pluridisciplinaire : conseil, coaching, psychopratique",
                    "Plus de 15 ans d’accompagnement de structures en mutation",
                ],
            },
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "nom": "Startup en hyper-croissance",
                "description": "Jeunes pousses Series A/B qui industrialisent leur acquisition et veulent un pipeline fiable.",
                "taille_structure": "20 à 80 salariés",
                "sous_secteur": "SaaS B2B en France et en Europe",
                "pitch": "J’aide les fondateurs et leurs équipes à grandir vite sans perdre ce qui les a fait démarrer : la relation et le sens.",
                "notes": "",
                "postes": ["Head of Growth", "VP Marketing", "CEO"],
                "triggers": [
                    "Levée Series A annoncée",
                    "Recrute un Head of Growth",
                    "Ouvre un nouveau marché",
                ],
                "pain_points": [
                    "Coût d’acquisition qui explose",
                    "Outbound mal industrialisé",
                    "Pipeline en dents de scie",
                ],
                "must_have": ["Levée < 18 mois", "Équipe growth en place"],
                "nice_to_have": [
                    "Stack moderne (HubSpot, Salesforce)",
                    "Présence internationale",
                ],
                "red_flags": ["Pivot en cours", "Plan social annoncé"],
                "sources": [
                    "LinkedIn Sales Navigator",
                    "Crunchbase",
                    "Maddyness",
                    "BFM Business",
                ],
                "benefices": [
                    "Cohésion d’équipe préservée à chaque palier",
                    "Posture de dirigeant renforcée",
                    "Transitions de phase (seed → série A) bien vécues",
                ],
                "preuves": [
                    "Anywaves, Taleez, Micropep Technologies, Connektica…",
                    "Coaching individuel et collectif, formation sur-mesure",
                ],
            },
            {
                "id": "33333333-3333-3333-3333-333333333333",
                "nom": "Collectivité locale",
                "description": "Communes et intercommunalités qui modernisent leur relation aux citoyens.",
                "taille_structure": "10 000 à 100 000 habitants",
                "sous_secteur": "Communes & EPCI en France",
                "pitch": "J’accompagne élus et DGS à embarquer leurs équipes dans les transformations, sans perdre personne en route.",
                "notes": "",
                "postes": ["DGS", "Directeur communication", "Adjoint au numérique"],
                "triggers": [
                    "Nouveau mandat",
                    "Ouverture d’un appel d’offres",
                    "Vote du budget annuel",
                ],
                "pain_points": [
                    "Faible participation citoyenne",
                    "Outils internes vieillissants",
                    "Contraintes RGPD et accessibilité",
                ],
                "must_have": ["Budget voté", "Référent identifié"],
                "nice_to_have": [
                    "Démarche France Relance",
                    "Conseil municipal des jeunes",
                ],
                "red_flags": [
                    "Élections dans moins de 6 mois",
                    "Contentieux en cours",
                ],
                "sources": [
                    "BOAMP",
                    "Annuaire des collectivités",
                    "Banque des Territoires",
                    "Presse quotidienne régionale",
                ],
                "benefices": [
                    "Agents alignés sur le projet de mandat",
                    "Conduite du changement maîtrisée",
                    "Dialogue élus / services apaisé",
                ],
                "preuves": [
                    "Castelsarrasin, Beauzelle, Villeneuve-Tolosane…",
                    "Approche relation, responsabilité, articulation individu / collectif",
                ],
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("segments")
