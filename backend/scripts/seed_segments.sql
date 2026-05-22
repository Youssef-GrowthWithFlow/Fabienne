-- Seed / refresh des 3 segments commerciaux de Fabienne Margollé (E-Move
-- Management) : accompagnement stratégique, coaching managérial et formation
-- en gestion du changement, principalement en Occitanie.
--
-- UPSERT par id : si le segment existe déjà, ses champs sont mis à jour ;
-- sinon il est créé. Idempotent — rejouable autant que voulu.
--
-- Application :
--   docker compose exec -T db psql -U fabienne -d fabienne_db < seed_segments.sql

\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Startup en croissance — structuration, posture dirigeant, CODIR
-- ---------------------------------------------------------------------------
INSERT INTO segments (
    id, nom, description, taille_structure, pitch,
    postes, activite_ciblee, zone_geographique,
    pain_points, must_have, should_have, red_flags,
    sources, benefices, preuves,
    data_sources, ai_sources, notes
) VALUES (
    'startup1',
    'Startup en croissance',
    'Startups françaises en phase de structuration ou post-levée. L''équipe grandit vite, le dirigeant doit installer une gouvernance, professionnaliser le management et embarquer les équipes dans le changement.',
    '20 à 200 salariés',
    'Accompagnement stratégique du dirigeant et de ses équipes : structuration de la gouvernance, mise en place d''un CODIR opérationnel, professionnalisation des pratiques managériales et activation de l''engagement collectif.',
    ARRAY['CEO / Fondateur', 'Cofondateur', 'COO', 'Directeur Général', 'DRH']::varchar[],
    ARRAY['Tech / SaaS', 'Deeptech', 'Greentech', 'Biotech', 'Industrie innovante']::varchar[],
    ARRAY['Occitanie', 'France']::varchar[],
    ARRAY[
        'Manque de vision stratégique et de leadership',
        'Dysfonctionnement du CODIR',
        'Déficit managérial à mesure que l''équipe grandit',
        'Déresponsabilisation des managers',
        'Résistance au changement',
        'Turnover élevé',
        'Difficulté à retenir les talents',
        'Désengagement des collaborateurs'
    ]::varchar[],
    ARRAY[
        'Plus de 20 salariés',
        'Levée de fonds récente',
        'Recrutement actif'
    ]::varchar[],
    ARRAY[
        'Création d''une antenne ou d''un nouveau site',
        'Lancement d''un nouveau service',
        'Fusion ou acquisition récente',
        'Changement de CEO récent'
    ]::varchar[],
    ARRAY[
        'Moins de 5 salariés',
        'Plan social récent'
    ]::varchar[],
    ARRAY['Maddyness', 'Pappers', 'Bpifrance', 'Frenchweb']::varchar[],
    ARRAY[
        'CODIR opérationnel et aligné',
        'Croissance pilotée sans casse humaine',
        'Équipes engagées et responsabilisées',
        'Dirigeant moins isolé dans ses décisions'
    ]::varchar[],
    ARRAY['Références : Anywaves, Anyfields, Ollow']::varchar[],
    ARRAY[]::varchar[],
    '[]'::jsonb,
    ''
)
ON CONFLICT (id) DO UPDATE SET
    nom = EXCLUDED.nom,
    description = EXCLUDED.description,
    taille_structure = EXCLUDED.taille_structure,
    pitch = EXCLUDED.pitch,
    postes = EXCLUDED.postes,
    activite_ciblee = EXCLUDED.activite_ciblee,
    zone_geographique = EXCLUDED.zone_geographique,
    pain_points = EXCLUDED.pain_points,
    must_have = EXCLUDED.must_have,
    should_have = EXCLUDED.should_have,
    red_flags = EXCLUDED.red_flags,
    sources = EXCLUDED.sources,
    benefices = EXCLUDED.benefices,
    preuves = EXCLUDED.preuves,
    data_sources = EXCLUDED.data_sources,
    ai_sources = EXCLUDED.ai_sources,
    updated_at = now();


-- ---------------------------------------------------------------------------
-- 2) Collectivité locale — séminaire, formation managériale, transformation
-- ---------------------------------------------------------------------------
INSERT INTO segments (
    id, nom, description, taille_structure, pitch,
    postes, activite_ciblee, zone_geographique,
    pain_points, must_have, should_have, red_flags,
    sources, benefices, preuves,
    data_sources, ai_sources, notes
) VALUES (
    'collect1',
    'Collectivité locale',
    'Communes et intercommunalités d''Occitanie, pilotées par leur DGS. Équipes à structurer, agents à embarquer dans la transformation, et besoin d''espaces de réflexion pour les cadres dans un contexte politique changeant.',
    'Plus de 8 000 habitants',
    'Accompagnement stratégique des DGS et de leurs équipes : séminaires, formations management sur mesure, ateliers d''analyse des pratiques professionnelles, soutien dans la gestion de crise et les transitions politiques.',
    ARRAY[
        'DGS',
        'Directrice Générale des Services',
        'Directeur Général des Services',
        'DGA',
        'Directeur des Ressources Humaines'
    ]::varchar[],
    ARRAY[
        'Mairie',
        'Communauté de communes',
        'Communauté d''agglomération',
        'Conseil départemental',
        'Syndicat mixte'
    ]::varchar[],
    ARRAY[
        'Occitanie',
        'Haute-Garonne (31)',
        'Tarn (81)',
        'Aveyron (12)',
        'Gers (32)',
        'Hautes-Pyrénées (65)',
        'Lot (46)',
        'Ariège (09)',
        'Tarn-et-Garonne (82)'
    ]::varchar[],
    ARRAY[
        'Résistance au changement dans les services',
        'Climat de travail tendu et conflits internes',
        'Désengagement des agents',
        'Déficit dans les pratiques managériales',
        'Pilotage difficile de nouveau projet',
        'Gestion de situation de crise',
        'Manque de collaboration inter-services'
    ]::varchar[],
    ARRAY[
        'Plus de 8 000 habitants',
        'Localisation Occitanie / Midi-Pyrénées'
    ]::varchar[],
    ARRAY[
        'Nouveau projet structurant',
        'Changement de DGS récent',
        'Post-élections municipales',
        'Création ou réorganisation de service'
    ]::varchar[],
    ARRAY['Moins de 8 000 habitants']::varchar[],
    ARRAY[
        'Association des Maires de France (AMF)',
        'Centre National de la Fonction Publique Territoriale (CNFPT)',
        'Annuaire des collectivités locales'
    ]::varchar[],
    ARRAY[
        'Équipe alignée et engagée sur les projets',
        'Fonctionnement interne fluidifié',
        'Cadre clair face à la crise',
        'Managers responsabilisés et acteurs du changement'
    ]::varchar[],
    ARRAY[
        'Références : mairies de Castelsarrasin et Cornebarrieu, conseils départementaux'
    ]::varchar[],
    ARRAY[]::varchar[],
    '[]'::jsonb,
    ''
)
ON CONFLICT (id) DO UPDATE SET
    nom = EXCLUDED.nom,
    description = EXCLUDED.description,
    taille_structure = EXCLUDED.taille_structure,
    pitch = EXCLUDED.pitch,
    postes = EXCLUDED.postes,
    activite_ciblee = EXCLUDED.activite_ciblee,
    zone_geographique = EXCLUDED.zone_geographique,
    pain_points = EXCLUDED.pain_points,
    must_have = EXCLUDED.must_have,
    should_have = EXCLUDED.should_have,
    red_flags = EXCLUDED.red_flags,
    sources = EXCLUDED.sources,
    benefices = EXCLUDED.benefices,
    preuves = EXCLUDED.preuves,
    data_sources = EXCLUDED.data_sources,
    ai_sources = EXCLUDED.ai_sources,
    updated_at = now();


-- ---------------------------------------------------------------------------
-- 3) Pharmacie en transition — rachat / transmission / prise de poste
-- ---------------------------------------------------------------------------
INSERT INTO segments (
    id, nom, description, taille_structure, pitch,
    postes, activite_ciblee, zone_geographique,
    pain_points, must_have, should_have, red_flags,
    sources, benefices, preuves,
    data_sources, ai_sources, notes
) VALUES (
    'pharma01',
    'Pharmacie en transition',
    'Pharmacies d''officine indépendantes en phase de rachat, transmission ou changement de titulaire. Petites équipes en transition, prise de poste à structurer et cohésion d''équipe à reconstruire dans un cadre humain délicat.',
    '3 à 15 salariés',
    'Accompagnement du nouveau titulaire et de son équipe en sortie de rachat ou de transmission : prise de poste, cohésion d''équipe, transmission douce de la patientèle, gestion du changement.',
    ARRAY[
        'Pharmacien titulaire',
        'Pharmacien adjoint',
        'Co-titulaires SEL / SELARL'
    ]::varchar[],
    ARRAY[
        'Pharmacie d''officine',
        'Pharmacie indépendante'
    ]::varchar[],
    ARRAY['Occitanie', 'France']::varchar[],
    ARRAY[
        'Prise de poste de nouveau titulaire',
        'Cohésion d''équipe pendant la transition',
        'Gestion du changement post-rachat',
        'Conflits internes hérités',
        'Transmission de la patientèle',
        'Résistance au changement de l''équipe en place'
    ]::varchar[],
    ARRAY[
        'Pharmacie d''officine indépendante',
        'Titulaire identifié'
    ]::varchar[],
    ARRAY[
        'Rachat récent',
        'Changement de titulaire récent',
        'Transmission en cours',
        'Création ou déménagement d''officine'
    ]::varchar[],
    ARRAY['Groupement ou chaîne intégrée']::varchar[],
    ARRAY[
        'Ordre National des Pharmaciens (CNOP)',
        'FINESS (data.gouv.fr)'
    ]::varchar[],
    ARRAY[
        'Prise de poste sereine pour le titulaire',
        'Équipe alignée autour du nouveau projet',
        'Transmission douce de la patientèle'
    ]::varchar[],
    ARRAY[]::varchar[],
    ARRAY['finess', 'ordre_pharmaciens']::varchar[],
    '[]'::jsonb,
    ''
)
ON CONFLICT (id) DO UPDATE SET
    nom = EXCLUDED.nom,
    description = EXCLUDED.description,
    taille_structure = EXCLUDED.taille_structure,
    pitch = EXCLUDED.pitch,
    postes = EXCLUDED.postes,
    activite_ciblee = EXCLUDED.activite_ciblee,
    zone_geographique = EXCLUDED.zone_geographique,
    pain_points = EXCLUDED.pain_points,
    must_have = EXCLUDED.must_have,
    should_have = EXCLUDED.should_have,
    red_flags = EXCLUDED.red_flags,
    sources = EXCLUDED.sources,
    benefices = EXCLUDED.benefices,
    preuves = EXCLUDED.preuves,
    data_sources = EXCLUDED.data_sources,
    ai_sources = EXCLUDED.ai_sources,
    updated_at = now();

COMMIT;

-- Verify ------------------------------------------------------------------
SELECT id, nom, taille_structure,
       array_length(postes, 1) AS nb_postes,
       array_length(pain_points, 1) AS nb_pain,
       array_length(must_have, 1) AS nb_must,
       array_length(should_have, 1) AS nb_should,
       data_sources
FROM segments
WHERE id IN ('startup1', 'collect1', 'pharma01')
ORDER BY id;
