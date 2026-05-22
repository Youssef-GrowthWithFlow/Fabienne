"""refine segments and seed real prospects from sheet/docs

Revision ID: 0012_real_seed
Revises: 0011_contact_signals
Create Date: 2026-05-15
"""
from __future__ import annotations

import json
import secrets
from datetime import date, datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "0012_real_seed"
down_revision = "0011_contact_signals"
branch_labels = None
depends_on = None

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Refined segment briefs (Pharmacie + Startup). Collectivité is left untouched
# because we don't yet have field-validated prospects in that segment.
# ---------------------------------------------------------------------------

PHARMA_BRIEF = {
    "nom": "Pharmacie de quartier",
    "description": (
        "Officines indépendantes ou en réseau (Aprium, Pharmabest, Lafayette, "
        "Pharmacorp) de la région toulousaine en phase de transition — reprise, "
        "passage en SELAS, transfert de site, recrutement massif — qui ont besoin "
        "de stabiliser leur équipe et clarifier leur gouvernance."
    ),
    "taille_structure": "3 à 50 salariés selon l'officine",
    "sous_secteur": "Officines indépendantes ou en réseau, agglomération toulousaine",
    "pitch": (
        "J'accompagne les titulaires et leurs équipes à traverser les transitions "
        "(reprise, passage SELAS, transfert) en gardant le collectif soudé et le "
        "fonctionnement quotidien fluide."
    ),
    "notes": "",
    "postes": ["Pharmacien titulaire", "Co-titulaires SELAS"],
    "pain_points": [
        "Reprise récente à structurer dès le démarrage",
        "Équipe nouvelle à stabiliser et coordonner",
        "Changement de structure juridique (SELAS) à organiser",
        "Pratiques managériales à poser dans une équipe agrandie",
        "Concurrence des chaînes et du e-commerce",
    ],
    "must_have": [
        "Reprise, changement de structure ou transfert récent (< 24 mois)",
        "Décideur joignable (titulaire ou co-titulaires)",
    ],
    "should_have": [
        "Équipe ≥ 4 pharmaciens",
        "Structure SELAS récente",
        "Adossée à un réseau (Aprium, Pharmabest, Lafayette, Pharmacorp…)",
        "Présence digitale active (site, Doctolib, e-commerce)",
    ],
    "red_flags": [
        "Procédure de liquidation",
        "Officine en cruise depuis 10+ ans sans changement",
        "Réseau fortement intégré qui couvre déjà le management interne",
    ],
    "sources": [
        "Annuaire de l'ordre des pharmaciens",
        "Pappers / Société.com",
        "LeMoniteurDesPharmacies.fr",
        "Google Maps / Pages Jaunes",
    ],
    "benefices": [
        "Équipe alignée dès le démarrage de la reprise",
        "Gouvernance post-SELAS clarifiée",
        "Climat de travail apaisé dans une équipe agrandie",
    ],
    "preuves": [
        "Approche pluridisciplinaire : conseil, coaching, psychopratique",
        "Plus de 15 ans d'accompagnement de structures en mutation",
    ],
}


STARTUP_BRIEF = {
    "nom": "Scale-up DeepTech post-levée",
    "description": (
        "DeepTech, biotech, greentech ou hardware basés à Toulouse (siège ou "
        "présence opérationnelle forte) qui viennent de lever ou s'apprêtent à "
        "lever, et passent de la R&D à l'industrialisation ou au scale international."
    ),
    "taille_structure": "6 à 50 salariés",
    "sous_secteur": "DeepTech / Biotech / Greentech / Hardware, écosystème toulousain",
    "pitch": (
        "J'aide les fondateurs et CODIR à structurer leur management après une "
        "levée, aligner les sites (Toulouse / Paris / international) et passer du "
        "pilote à l'industrialisation sans casser la culture."
    ),
    "notes": "",
    "postes": ["CEO / Fondateur", "COO / Directeur général", "Directeur de programme"],
    "pain_points": [
        "Structuration du management après levée (CODIR à composer)",
        "Alignement multi-sites (Paris / Toulouse, France / US…)",
        "Passage R&D → industrialisation / production série",
        "Recrutement accéléré sans dégrader la culture",
        "Clarification des rôles entre fondateurs",
    ],
    "must_have": [
        "Levée de fonds récente (< 18 mois) ou en cours visible publiquement",
        "Siège ou présence opérationnelle forte à Toulouse",
        "Décideur joignable (CEO / fondateur)",
    ],
    "should_have": [
        "DeepTech / Hardware / Biotech / Greentech",
        "Multi-sites ou présence internationale",
        "Équipe 10-50 personnes",
        "Validation marché (clients ou pilotes signés)",
    ],
    "red_flags": [
        "Pivot stratégique en cours",
        "Plan social ou difficultés financières publiques",
        "Pré-seed sans traction marché",
    ],
    "sources": [
        "Maddyness, La French Tech Toulouse",
        "Occitanie Invest",
        "LinkedIn Sales Navigator",
        "Crunchbase, Pappers",
    ],
    "benefices": [
        "Cohésion d'équipe préservée à chaque palier",
        "Posture du CEO et du CODIR renforcée",
        "Passage du pilote au scale industriel mieux orchestré",
    ],
    "preuves": [
        "Anywaves, Taleez, Micropep Technologies, Connektica…",
        "Coaching individuel et collectif, ateliers CODIR sur-mesure",
    ],
}


# ---------------------------------------------------------------------------
# Fiches détaillées (HTML) — synthèse manuelle des docs.
# Format : 4 sections, vocabulaire aligné sur Prospect (indicateurs / infos / alerte).
# ---------------------------------------------------------------------------


def fiche(activite: str, specificite: str, indicateurs: str, infos: str, alerte: str, approche: str) -> str:
    return (
        "<h2>Activité & identité</h2>\n"
        f"<p>{activite}</p>\n\n"
        "<h2>Spécificité</h2>\n"
        f"<p>{specificite}</p>\n\n"
        "<h2>Signaux détectés</h2>\n"
        "<ul>\n"
        f"  <li><strong>Indicateurs clés :</strong> {indicateurs}</li>\n"
        f"  <li><strong>Infos utiles :</strong> {infos}</li>\n"
        f"  <li><strong>Signaux d'alerte :</strong> {alerte}</li>\n"
        "</ul>\n\n"
        "<h2>Approche commerciale suggérée</h2>\n"
        f"<p>{approche}</p>"
    )


# ---------------------------------------------------------------------------
# 10 prospects from the sheet, with rich fiches synthesized from the docs.
# Dates: docs were created late April 2026 → use that as created_at.
# Contacté: contacted ~2026-05-01, relance J+7. Refus: closed ~2026-05-08.
# ---------------------------------------------------------------------------


PROSPECTS: list[dict] = [
    # ---------- Pharmacies ----------
    {
        "id": "p-genieys",
        "nom": "Emilie Genieys",
        "entreprise": "Pharmacie Genieys",
        "role": "Pharmacien titulaire",
        "segment": "pharma01",
        "status": "Contacté",
        "email": "pharmacie.gratentour@gmail.com",
        "telephone": "05 61 82 37 64",
        "linkedin": None,
        "website": "https://pharmacie-gratentour.pharmaxv.fr/",
        "taille": "1-10",
        "ca": "",
        "origine": "Recherche pharmacies Toulouse 2026",
        "indicateurs_cles": "Reprise très récente (avril 2026), officine indépendante, équipe entièrement renouvelée",
        "infos_utiles": "4 pharmaciens (1 titulaire + 3 adjoints), Gratentour (25 km Toulouse), rachat du fonds 1,825 M€",
        "signaux_alerte": "",
        "fiche_client": fiche(
            activite="Officine indépendante située au 4 Rue du Barry à Gratentour (31150). Reprise début avril 2026 par Emilie Genieys via rachat du fonds à 1,825 M€. Équipe de 4 pharmaciens entièrement renouvelée à la reprise.",
            specificite="Phase critique de démarrage opérationnel : nouvelle titulaire, équipe constituée en même temps, nouvelle structure juridique, repositionnement en cours. Emilie Genieys exerçait déjà dans l'ancienne Pharmacie Fourcans, donc connaissance terrain mais structure neuve à poser.",
            indicateurs="Reprise très récente (avril 2026), officine indépendante confirmée, équipe entièrement renouvelée.",
            infos="4 pharmaciens (1 titulaire + 3 adjoints dont 2 temps partiel), Gratentour (25 km Toulouse), transaction publique tracée.",
            alerte="Aucun détecté.",
            approche="Phase où tout est à structurer : communication, fidélisation patient, acquisition. Bon timing pour accompagner la mise en place dès le départ. Angle : structurer le démarrage opérationnel et poser des pratiques managériales fluides dans une équipe neuve.",
        ),
        "created_at": date(2026, 4, 25),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "Reprise très récente (avril 2026). Équipe entièrement renouvelée.",
    },
    {
        "id": "p-borderouge",
        "nom": "Luc Remy / Agathe Peyrouzet-Rigal",
        "entreprise": "Pharmacie Borderouge",
        "role": "Pharmacien titulaire",
        "segment": "pharma01",
        "status": "Contacté",
        "email": "pharmacieborderouge@gmail.com",
        "telephone": "05 61 48 07 80",
        "linkedin": "https://www.linkedin.com/in/luc-remy-8baa6a79/",
        "website": "https://pharmacie-borderouge-toulouse.mesoigner.fr/",
        "taille": "51-200",
        "ca": "~7 M€",
        "origine": "Recherche pharmacies Toulouse 2026",
        "indicateurs_cles": "Reprise mars 2026, SELAS récente, co-titulaires nouveaux",
        "infos_utiles": "6 pharmaciens, ~20-50 salariés, ~7 M€ CA, réseau Pharmabest",
        "signaux_alerte": "Réseau Pharmabest couvre déjà achats/marketing — marge sur ces sujets limitée",
        "fiche_client": fiche(
            activite="Pharmacie de taille importante (≈20-50 salariés, ~7 M€ CA) située au 2 Rue Louise Weiss à Toulouse (quartier Borderouge). Reprise complète au 1er mars 2026 par Luc Remy et Agathe Peyrouzet-Rigal avec une nouvelle équipe d'adjoints.",
            specificite="Phase de transition opérationnelle profonde : nouvelle direction, nouvelle équipe, nouvelle structure (SELAS 2026). Adossée à Pharmabest, un groupement de grandes officines avec outils, achats et marketing mutualisés — mais peu d'accompagnement sur le management interne.",
            indicateurs="Reprise très récente (mars 2026), structure SELAS, co-titulaires nouvellement inscrits.",
            infos="6 pharmaciens (2 co-titulaires + 4 adjoints), équipe globale 20-50 salariés, ~7 M€ CA, réseau Pharmabest.",
            alerte="Pharmabest couvre déjà la dimension achats/marketing — l'enjeu réel est sur le management terrain, pas sur la structuration commerciale.",
            approche="Reprise + équipe large + réseau structurant = besoin d'aligner rapidement l'organisation et de fluidifier le fonctionnement au quotidien. Angle : pratiques managériales, coordination interne, accompagnement du changement post-reprise.",
        ),
        "created_at": date(2026, 4, 25),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "Reprise très récente (mars 2026). Équipe complète renouvelée.",
    },
    {
        "id": "p-lafayette",
        "nom": "Audrey Allogne / Jean-Baptiste Pradel",
        "entreprise": "Selas Pharmacie Lafayette Pradel",
        "role": "Pharmacien titulaire",
        "segment": "pharma01",
        "status": "Contacté",
        "email": "",
        "telephone": "05 61 49 18 22",
        "linkedin": None,
        "website": "https://www.pharmacielafayette.com/toulouse-saint-martin",
        "taille": "51-200",
        "ca": "~9,4 M€",
        "origine": "Recherche pharmacies Toulouse 2026",
        "indicateurs_cles": "Reprise octobre 2024, SELAS depuis 2021, grosse officine 9,4 M€ CA",
        "infos_utiles": "9 pharmaciens, présidence changée fin 2024 (Philippe → Jean-Baptiste Pradel), réseau Pharmacie Lafayette",
        "signaux_alerte": "Enseigne nationale très structurée (prix bas/volume) — peu de marge sur achats/marketing",
        "fiche_client": fiche(
            activite="Grosse officine SELAS (depuis 2021) située au 166 Route de Bayonne à Toulouse, sous l'enseigne nationale Pharmacie Lafayette. CA 2024 ≈ 9,44 M€. Équipe de 9 pharmaciens identifiés publiquement.",
            specificite="Structure déjà bien installée mais en pleine recomposition managériale : reprise/structuration en octobre 2024, présidence modifiée fin 2024 (sortie de Philippe Pradel, prise de poste de Jean-Baptiste Pradel), plusieurs inscriptions d'adjoints en 2024 et 2025.",
            indicateurs="Reprise récente (octobre 2024), SELAS structurée, gouvernance refondue fin 2024.",
            infos="9 pharmaciens (2 co-titulaires + 7 adjoints), CA ~9,4 M€, enseigne Pharmacie Lafayette (prix bas, volume, services standardisés).",
            alerte="Le cadre commercial est déjà très standardisé par l'enseigne — pas d'angle commercial / marketing à proposer, l'enjeu est sur la coordination interne d'une équipe large.",
            approche="Mieux faire fonctionner une équipe large dans un cadre enseigne déjà posé : pratiques managériales, leadership, feedback, coordination, accompagnement du changement et gestion des tensions entre adjoints récemment arrivés.",
        ),
        "created_at": date(2026, 4, 25),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "Reprise récente (2024). Grosse officine ~9,4 M€ de CA.",
    },
    {
        "id": "p-grandouest",
        "nom": "Arnaud Laures",
        "entreprise": "Aprium Pharmacie Grand Ouest",
        "role": "Pharmacien titulaire",
        "segment": "pharma01",
        "status": "Contacté",
        "email": "pharmacie.grandouest.31@gmail.com",
        "telephone": "05 61 07 53 07",
        "linkedin": None,
        "website": "https://grandouest-leguevin.aprium-pharmacie.fr/mapharmacie",
        "taille": "1-10",
        "ca": "",
        "origine": "Recherche pharmacies Toulouse 2026",
        "indicateurs_cles": "Nouveau titulaire septembre 2025, transfert de site 2025, équipe récente",
        "infos_utiles": "4 pharmaciens, Léguevin (15 km Toulouse), réseau Aprium (~500 officines)",
        "signaux_alerte": "",
        "fiche_client": fiche(
            activite="Officine située au 13 Rue de Ribosi à Léguevin, sous enseigne Aprium (~500 officines en France). Société créée en 2023, site actuel en activité depuis septembre 2025 suite au transfert depuis le 1 rue de la Bastide.",
            specificite="Configuration encore récente : reprise + déplacement du site fin 2025. Équipe constituée entre septembre 2025 et février 2026, donc en phase de prise de repères. Le cadre enseigne Aprium existe déjà — l'enjeu est de faire tourner l'équipe dans ce nouveau contexte.",
            indicateurs="Transformation récente avec transfert de site (septembre 2025), nouveau titulaire, équipe entièrement récente.",
            infos="4 pharmaciens (1 titulaire + 3 adjoints récents), Léguevin (15 km Toulouse), réseau Aprium national.",
            alerte="Aucun détecté.",
            approche="Aider une officine tout juste reprise et déplacée à stabiliser son équipe, clarifier son organisation et sécuriser sa montée en puissance. Angle : leadership, coordination, communication interne, accompagnement du changement et gestion des tensions dans une équipe en formation.",
        ),
        "created_at": date(2026, 4, 25),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "Transformation récente, transfert de site (2025).",
    },
    {
        "id": "p-cyprie",
        "nom": "Elise Fresnay / Vincent Gausserand",
        "entreprise": "Pharmacie Fresnay - Gausserand",
        "role": "Pharmacien titulaire",
        "segment": "pharma01",
        "status": "Refus",
        "email": "pharmacieducyprie@orange.fr",
        "telephone": "05 61 24 45 40",
        "linkedin": None,
        "website": "https://pharmacieducyprie.pharmacorp.fr/",
        "taille": "11-50",
        "ca": "",
        "origine": "Recherche pharmacies Toulouse 2026",
        "indicateurs_cles": "Passage en SELAS février 2026, co-titulaires historiques",
        "infos_utiles": "5 pharmaciens, Balma, réseau Pharmacorp",
        "signaux_alerte": "Pas une reprise — juste un changement de structure interne (besoin moins net)",
        "fiche_client": fiche(
            activite="Pharmacie du Cyprie, officine de taille intermédiaire située au 1 Esplanade Albert Schweitzer à Balma. En place depuis longtemps mais passée en SELAS au 1er février 2026.",
            specificite="Pas une reprise mais une nouvelle étape d'organisation : les co-titulaires Vincent Gausserand et Elise Fresnay sont déjà historiques (mentions légales inchangées). Le passage SELAS sert à mieux organiser qui décide et comment l'officine évolue dans le temps.",
            indicateurs="Changement de structure juridique vers SELAS (février 2026), co-titulaires historiques.",
            infos="5 pharmaciens (2 co-titulaires + 3 adjoints), réseau Pharmacorp, Balma.",
            alerte="Pas de reprise donc pas de discontinuité opérationnelle — le besoin de structuration est plus modéré qu'une officine fraîchement reprise.",
            approche="Aider l'équipe à traverser le changement de structure sans flou sur les rôles, les décisions et le pilotage. Angle : transition, gouvernance, organisation, communication interne et alignement de l'équipe. Profil moins prioritaire qu'une vraie reprise.",
        ),
        "created_at": date(2026, 4, 26),
        "contacted_at": date(2026, 5, 1),
        "relance_date": None,
        "note_comment": "Changement de structure vers SELAS (2026), mais co-titulaires historiques.",
    },
    # ---------- Startups ----------
    {
        "id": "p-univity",
        "nom": "Charles Delfieux",
        "entreprise": "Univity",
        "role": "CEO & Fondateur",
        "segment": "startup1",
        "status": "Contacté",
        "email": "charles.delfieux@univity.global",
        "telephone": "",
        "linkedin": "https://www.linkedin.com/in/charles-delfieux/",
        "website": "https://www.univity.global/",
        "taille": "11-50",
        "ca": "",
        "origine": "Veille DeepTech Toulouse 2026",
        "indicateurs_cles": "Levée 27 M€ Series A (avril 2026), contrat CNES 31 M€, multi-sites Paris/Toulouse",
        "infos_utiles": "15-30 employés, télécom/spatial, démonstrateur 5G spatiale, vise constellation 1600-3400 satellites",
        "signaux_alerte": "Industrialisation prévue à partir de 2028 — roadmap longue",
        "fiche_client": fiche(
            activite="Univity développe des satellites permettant aux opérateurs télécom d'envoyer de la 5G depuis l'espace pour couvrir les zones blanches, avec compatibilité smartphones et infrastructure existante. Siège à Paris (75014), présence opérationnelle forte à Toulouse (55 Av. Louis Breguet, site CNES).",
            specificite="Passage de la preuve technique à l'industrialisation. Levée Series A de 27 M€ le 23 avril 2026 (Bpifrance, Expansion, Blast Club) + soutien CNES de 31 M€ annoncé en septembre 2025. Trajectoire ambitieuse : production de 40 satellites/mois visée à partir de 2028.",
            indicateurs="Levée 27 M€ Series A (avril 2026), contrat CNES 31 M€, multi-sites Paris/Toulouse, écosystème CNES.",
            infos="15-30 employés, télécom/spatial, démonstrateur 5G spatiale, constellation visée 1600-3400 satellites.",
            alerte="Roadmap industrielle longue (production série en 2028) — leviers d'accompagnement plus orientés management que delivery immédiat.",
            approche="Recruter, structurer, livrer un programme complexe, aligner Paris, Toulouse, le CNES et les investisseurs. Angle : structuration du management, clarification des rôles, alignement Paris/Toulouse, accompagnement CODIR, pilotage de la croissance et de l'industrialisation.",
        ),
        "created_at": date(2026, 4, 26),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "27 M€ Levé + Contrat CNES 32 M€ (février 2026).",
    },
    {
        "id": "p-aviwell",
        "nom": "Rémy Burcelin",
        "entreprise": "Aviwell",
        "role": "Fondateur",
        "segment": "startup1",
        "status": "Contacté",
        "email": "contact@aviwell.fr",
        "telephone": "",
        "linkedin": "https://www.linkedin.com/in/r%C3%A9my-burcelin-98313b1a/",
        "website": "https://www.aviwell.fr/fr/",
        "taille": "11-50",
        "ca": "",
        "origine": "Veille DeepTech Toulouse 2026",
        "indicateurs_cles": "Levée 11 M€ Series A (janvier 2026), nouvelle levée 10 M€ visée fin 2026, multi-sites France/US",
        "infos_utiles": "23 employés, biotech nutrition animale durable, plateforme IA + microbiote, Toulouse + Boston (MA)",
        "signaux_alerte": "Alignement France/US à maintenir post-scale",
        "fiche_client": fiche(
            activite="Aviwell développe des solutions naturelles pour améliorer la santé et la croissance des animaux d'élevage via une plateforme IA + microbiote. Siège à Toulouse (135 av. de Rangueil) et présence US à Lowell (MA). 23 collaborateurs.",
            specificite="Passage R&D / validation scientifique → déploiement marché. Levée Series A de 11 M€ annoncée en janvier 2026, nouvelle levée d'~10 M€ envisagée fin 2026 / début 2027 pour accélérer le déploiement commercial et international.",
            indicateurs="Levée 11 M€ Series A (janvier 2026), nouvelle levée 10 M€ prévue, structure multi-sites France/US.",
            infos="23 employés, biotech nutrition animale, plateforme IA / microbiote, écosystème TWB / Inserm, CEO basé Boston (Chandra Mouli Ramani).",
            alerte="Le sujet n'est plus scientifique : il faut maintenant structurer, recruter, vendre, livrer, et tenir l'alignement Toulouse / US.",
            approche="Structurer l'équipe, recruter, vendre, livrer, et garder l'alignement entre Toulouse et les États-Unis. Angle : structuration du management, clarification des rôles, alignement France/US, accompagnement CODIR, passage à l'échelle sans créer de friction interne.",
        ),
        "created_at": date(2026, 4, 26),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "Levé fonds 11 M€ (avril 2026). Impact positif cause animalière.",
    },
    {
        "id": "p-floodframe",
        "nom": "Caroline Lapelerie",
        "entreprise": "FloodFrame",
        "role": "Directrice Générale - Associée",
        "segment": "startup1",
        "status": "Contacté",
        "email": "contact@floodframe.fr",
        "telephone": "",
        "linkedin": "https://www.linkedin.com/in/caroline-lapelerie-954022149/",
        "website": "https://floodframe.fr/",
        "taille": "1-10",
        "ca": "350 k€",
        "origine": "Veille DeepTech Toulouse 2026",
        "indicateurs_cles": "Levée 1 M€ visée (annonce 2025), changement DG juin 2025, visibilité nationale (JCDecaux, Allianz)",
        "infos_utiles": "6 employés, greentech anti-inondation, démonstrations Allianz à Baziège, ~350 k€ CA visé",
        "signaux_alerte": "Levée 1 M€ pas encore confirmée publiquement — société en pré-scale",
        "fiche_client": fiche(
            activite="FloodFrame développe un airbag anti-inondation pour bâtiments : système enterré autour du bâtiment, invisible au quotidien, qui se déploie automatiquement quand l'eau monte. Siège au 27 Rue d'Aubuisson à Toulouse, 6 employés.",
            specificite="Société en pré-scale : produit concret, visibilité croissante (campagne JCDecaux oct 2025, démos Allianz à Baziège), premiers signaux commerciaux. Gouvernance restructurée le 19/06/2025 : EUREKA devient Président, Caroline Lapelerie Directrice générale (remplace Philippe Dussoulier).",
            indicateurs="Levée 1 M€ visée pour 2025, changement de gouvernance juin 2025, présence nationale émergente.",
            infos="6 employés, greentech anti-inondation, ~350 k€ CA, démonstrations Allianz, centre d'essai Baziège.",
            alerte="Levée d'1 M€ pas confirmée publiquement — pas encore un dossier post-levée mais une société en pré-scale.",
            approche="Clarifier les rôles après le changement de gouvernance, structurer le pilotage commercial et industriel, préparer les recrutements, transformer la visibilité en ventes, stabiliser l'organisation avant l'accélération.",
        ),
        "created_at": date(2026, 4, 26),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "Levée 1 M€ visée, DG changée (2025), Early.",
    },
    {
        "id": "p-donecle",
        "nom": "Matthieu Claybrough",
        "entreprise": "Donecle",
        "role": "CEO",
        "segment": "startup1",
        "status": "Contacté",
        "email": "matthieu.claybrough@donecle.com",
        "telephone": "",
        "linkedin": "https://www.linkedin.com/in/matthieuclaybrough/",
        "website": "https://www.donecle.com/",
        "taille": "11-50",
        "ca": "",
        "origine": "Veille DeepTech Toulouse 2026",
        "indicateurs_cles": "Levée 10 M€ (avril 2026), expansion Europe/US, filiale Chicago, recrutement 15 postes",
        "infos_utiles": "35 employés, drones inspection avions, clients United/LATAM/DHL/Lufthansa/Armée de l'air, approuvé FAA/EASA",
        "signaux_alerte": "",
        "fiche_client": fiche(
            activite="Donecle automatise l'inspection des avions avec des drones autonomes et de l'IA : photographie l'appareil, détecte les défauts, aide les équipes de maintenance. Siège à Toulouse (55 av. Louis Breguet), 35 employés. Solution approuvée FAA/EASA, listée Airbus AMM.",
            specificite="Passage d'une solution déjà validée à une phase de scale international. Levée 10 M€ menée par IRDI Capital Investissement et SWEN Capital Partners en avril 2026. Ouverture filiale Chicago. Industrialisation : production qui passe de 4 à 10 drones/mois.",
            indicateurs="Levée 10 M€ (avril 2026), expansion Europe/US, filiale Chicago ouverte, recrutement de 15 postes dont 10 à Toulouse.",
            infos="35 employés, drones inspection avions, clients prestigieux (United, LATAM, DHL, Viva, Lufthansa, Armée de l'air, Royal Air Force), nouveau cap logiciel autour de la maintenance prédictive.",
            alerte="Aucun détecté.",
            approche="Le sujet n'est plus seulement technique : structurer l'équipe, industrialiser, recruter, vendre à l'international, garder l'alignement Toulouse / Europe / US. Angle : structuration du management, clarification des rôles, organisation de la croissance internationale, alignement produit/tech/commercial, accompagnement CODIR.",
        ),
        "created_at": date(2026, 4, 26),
        "contacted_at": date(2026, 5, 1),
        "relance_date": date(2026, 5, 8),
        "note_comment": "10 M€ Levé (avril 2026). Expansion Europe/US, recrutement.",
    },
    {
        "id": "p-orius",
        "nom": "Paul-Hector Oliver",
        "entreprise": "Orius",
        "role": "CEO & Fondateur",
        "segment": "startup1",
        "status": "Refus",
        "email": "ph.oliver@orius.co",
        "telephone": "06 88 39 44 54",
        "linkedin": "https://www.linkedin.com/in/paul-hector-oliver/",
        "website": "https://www.orius.co/",
        "taille": "11-50",
        "ca": "",
        "origine": "Veille DeepTech Toulouse 2026",
        "indicateurs_cles": "Levée 5 M€ en cours, pilote industriel Escalquens (500 m²), projet usine 20 000 m²",
        "infos_utiles": "10-15 employés, biotech végétale, marchés cosmétique/nutraceutique/pharma/spatial, Occitanie Invest 2025",
        "signaux_alerte": "Levée pas encore close, plusieurs marchés à prioriser, gouvernance complexe (3 fondateurs + sociétés holdings)",
        "fiche_client": fiche(
            activite="Orius cultive des plantes en environnement contrôlé pour produire des ingrédients botaniques à haute valeur ajoutée (maîtrise lumière, humidité, température, nutriments). Marchés cosmétique, nutraceutique, pharma, spatial. Siège Toulouse (6 place Wilson), pilote industriel à Escalquens.",
            specificite="Pilote industriel de 500 m² lancé en juin 2024, projet d'usine de 20 000 m² autour de Toulouse, 10 M€ de production annuelle signés pour 2028 avec un acteur cosmétique. Origine spatiale (contrat CNES sur systèmes alimentaires pour bases lunaires). Gouvernance via REVOLI EURL (président), NESASIO et APEX (DG).",
            indicateurs="Levée 5 M€ en cours, sélection Occitanie Invest 2025, pilote industriel actif, projet usine 20 000 m².",
            infos="10-15 employés, biotech végétale, marchés multiples (cosmétique/nutraceutique/pharma/spatial), participation au projet PhytomAbs (France 2030) avec Plantibodies.",
            alerte="Levée pas encore close, plusieurs marchés à prioriser, gouvernance complexe (3 fondateurs + sociétés holdings).",
            approche="Structurer le management, clarifier les rôles entre les fondateurs, organiser le passage pilote → production, préparer la levée et les recrutements, prioriser les marchés. Installer un pilotage simple avant l'ouverture du site industriel plus grand.",
        ),
        "created_at": date(2026, 4, 26),
        "contacted_at": date(2026, 5, 1),
        "relance_date": None,
        "note_comment": "Levée en cours 5 M€. Pilote industriel 500 m² à Escalquens.",
    },
]


# ---------------------------------------------------------------------------
# DDL helpers
# ---------------------------------------------------------------------------

KIND_TEXT = {
    "created": "Prospect créé",
    "message": "Message envoyé",
    "lost": "Refus",
}


def _at(d: date, hour: int) -> datetime:
    return datetime(d.year, d.month, d.day, hour, 0, 0, tzinfo=UTC)


def _insert_prospect(conn, p: dict) -> None:
    pid = p["id"]
    conn.execute(
        sa.text(
            """
            INSERT INTO prospects (
                id, nom, entreprise, role, segment, status,
                email, telephone, linkedin, website,
                taille, ca, origine,
                indicateurs_cles, infos_utiles, signaux_alerte,
                fiche_client, created_at, contacted_at, relance_date
            ) VALUES (
                :id, :nom, :entreprise, :role, :segment, :status,
                :email, :telephone, :linkedin, :website,
                :taille, :ca, :origine,
                :indicateurs_cles, :infos_utiles, :signaux_alerte,
                :fiche_client, :created_at, :contacted_at, :relance_date
            )
            """
        ),
        {
            "id": pid,
            "nom": p["nom"],
            "entreprise": p["entreprise"],
            "role": p["role"],
            "segment": p["segment"],
            "status": p["status"],
            "email": p["email"],
            "telephone": p["telephone"],
            "linkedin": p["linkedin"],
            "website": p["website"],
            "taille": p["taille"],
            "ca": p["ca"],
            "origine": p["origine"],
            "indicateurs_cles": p["indicateurs_cles"],
            "infos_utiles": p["infos_utiles"],
            "signaux_alerte": p["signaux_alerte"],
            "fiche_client": p["fiche_client"],
            "created_at": p["created_at"],
            "contacted_at": p["contacted_at"],
            "relance_date": p["relance_date"],
        },
    )

    # 1) "created" action + comment
    created_action_id = secrets.token_hex(8)
    created_at_dt = _at(p["created_at"], 9)
    conn.execute(
        sa.text(
            "INSERT INTO actions (id, prospect_id, kind, at, metadata) "
            "VALUES (:id, :pid, 'created', :at, NULL)"
        ),
        {"id": created_action_id, "pid": pid, "at": created_at_dt},
    )
    conn.execute(
        sa.text(
            "INSERT INTO comments (id, prospect_id, action_id, date, texte) "
            "VALUES (:id, :pid, :aid, :at, :txt)"
        ),
        {
            "id": secrets.token_hex(8),
            "pid": pid,
            "aid": created_action_id,
            "at": created_at_dt,
            "txt": KIND_TEXT["created"],
        },
    )

    # 2) status action (message or lost)
    if p["status"] == "Contacté" and p["contacted_at"]:
        msg_action_id = secrets.token_hex(8)
        msg_at = _at(p["contacted_at"], 10)
        conn.execute(
            sa.text(
                "INSERT INTO actions (id, prospect_id, kind, at, metadata) "
                "VALUES (:id, :pid, 'message', :at, :meta)"
            ),
            {
                "id": msg_action_id,
                "pid": pid,
                "at": msg_at,
                "meta": json.dumps({"platform": "Email"}),
            },
        )
        conn.execute(
            sa.text(
                "INSERT INTO comments (id, prospect_id, action_id, date, texte) "
                "VALUES (:id, :pid, :aid, :at, :txt)"
            ),
            {
                "id": secrets.token_hex(8),
                "pid": pid,
                "aid": msg_action_id,
                "at": msg_at,
                "txt": "Message Email",
            },
        )
    elif p["status"] == "Refus" and p["contacted_at"]:
        # Logged a first contact then refused
        msg_action_id = secrets.token_hex(8)
        msg_at = _at(p["contacted_at"], 10)
        conn.execute(
            sa.text(
                "INSERT INTO actions (id, prospect_id, kind, at, metadata) "
                "VALUES (:id, :pid, 'message', :at, :meta)"
            ),
            {
                "id": msg_action_id,
                "pid": pid,
                "at": msg_at,
                "meta": json.dumps({"platform": "Email"}),
            },
        )
        conn.execute(
            sa.text(
                "INSERT INTO comments (id, prospect_id, action_id, date, texte) "
                "VALUES (:id, :pid, :aid, :at, :txt)"
            ),
            {
                "id": secrets.token_hex(8),
                "pid": pid,
                "aid": msg_action_id,
                "at": msg_at,
                "txt": "Message Email",
            },
        )
        lost_action_id = secrets.token_hex(8)
        lost_at = _at(date(2026, 5, 8), 14)
        conn.execute(
            sa.text(
                "INSERT INTO actions (id, prospect_id, kind, at, metadata) "
                "VALUES (:id, :pid, 'lost', :at, NULL)"
            ),
            {"id": lost_action_id, "pid": pid, "at": lost_at},
        )
        conn.execute(
            sa.text(
                "INSERT INTO comments (id, prospect_id, action_id, date, texte) "
                "VALUES (:id, :pid, :aid, :at, :txt)"
            ),
            {
                "id": secrets.token_hex(8),
                "pid": pid,
                "aid": lost_action_id,
                "at": lost_at,
                "txt": KIND_TEXT["lost"],
            },
        )

    # 3) free-text note comment (from the sheet)
    if p.get("note_comment"):
        note_at = _at(p["created_at"], 11)
        conn.execute(
            sa.text(
                "INSERT INTO comments (id, prospect_id, action_id, date, texte) "
                "VALUES (:id, :pid, NULL, :at, :txt)"
            ),
            {
                "id": secrets.token_hex(8),
                "pid": pid,
                "at": note_at,
                "txt": p["note_comment"],
            },
        )


def _update_segment(conn, segment_id: str, brief: dict) -> None:
    conn.execute(
        sa.text(
            """
            UPDATE segments SET
                nom = :nom,
                description = :description,
                taille_structure = :taille_structure,
                sous_secteur = :sous_secteur,
                pitch = :pitch,
                notes = :notes,
                postes = :postes,
                pain_points = :pain_points,
                must_have = :must_have,
                should_have = :should_have,
                red_flags = :red_flags,
                sources = :sources,
                benefices = :benefices,
                preuves = :preuves,
                updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": segment_id, **brief},
    )


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Refine segment briefs (pharma01 + startup1)
    _update_segment(conn, "pharma01", PHARMA_BRIEF)
    _update_segment(conn, "startup1", STARTUP_BRIEF)

    # 2. Drop placeholder seed prospects (cascades comments + actions)
    conn.execute(sa.text("DELETE FROM prospects WHERE id LIKE 'p-seed-%'"))

    # 3. Insert real prospects with their actions + comments
    for p in PROSPECTS:
        _insert_prospect(conn, p)


def downgrade() -> None:
    conn = op.get_bind()
    real_ids = [p["id"] for p in PROSPECTS]
    if real_ids:
        conn.execute(
            sa.text("DELETE FROM prospects WHERE id = ANY(:ids)"),
            {"ids": real_ids},
        )
    # Note: we don't restore the placeholder seed nor the old segment briefs.
