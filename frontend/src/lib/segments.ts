import type { Segment } from '@/lib/prospects'

export type SegmentBrief = {
  nom: string
  description: string
  postes: string[]
  tailleStructure: string
  sousSecteur: string
  triggers: string[]
  painPoints: string[]
  mustHave: string[]
  niceToHave: string[]
  redFlags: string[]
  sources: string[]
  pitch: string
  benefices: string[]
  preuves: string[]
  notes: string
}

export const EMPTY_SEGMENT_BRIEF: SegmentBrief = {
  nom: '',
  description: '',
  postes: [],
  tailleStructure: '',
  sousSecteur: '',
  triggers: [],
  painPoints: [],
  mustHave: [],
  niceToHave: [],
  redFlags: [],
  sources: [],
  pitch: '',
  benefices: [],
  preuves: [],
  notes: '',
}

export const INITIAL_BRIEFS: Record<Segment, SegmentBrief> = {
  Pharmacie: {
    ...EMPTY_SEGMENT_BRIEF,
    nom: 'Pharmacie de quartier',
    description:
      'Officines indépendantes en France qui veulent fidéliser leur patientèle et résister aux chaînes.',
    postes: ['Pharmacien titulaire', 'Pharmacien adjoint'],
    tailleStructure: '2 à 8 salariés',
    sousSecteur: 'Officines indépendantes en France',
    triggers: [
      'Vient de reprendre l’officine',
      'Lance un programme de fidélité',
      'Ouvre un service click & collect',
    ],
    painPoints: [
      'Patientèle qui s’érode',
      'Pas le temps de communiquer',
      'Concurrence des chaînes et du e-commerce',
    ],
    mustHave: ['Officine indépendante', 'Décideur joignable'],
    niceToHave: ['Présence sur les réseaux sociaux', 'Équipe déjà digitalisée'],
    redFlags: ['Rachat par un groupe en cours', 'Procédure de liquidation'],
    sources: [
      'LeMoniteurDesPharmacies.fr',
      'Ordre des pharmaciens',
      'Pappers',
      'Pages Jaunes',
    ],
    pitch:
      'J’accompagne les titulaires et leurs équipes à traverser les transitions (reprise, recomposition) en gardant le collectif soudé.',
    benefices: [
      'Équipe réalignée sur un cap commun',
      'Posture du titulaire clarifiée',
      'Climat de travail apaisé',
    ],
    preuves: [
      'Approche pluridisciplinaire : conseil, coaching, psychopratique',
      'Plus de 15 ans d’accompagnement de structures en mutation',
    ],
  },
  Startup: {
    ...EMPTY_SEGMENT_BRIEF,
    nom: 'Startup en hyper-croissance',
    description:
      'Jeunes pousses Series A/B qui industrialisent leur acquisition et veulent un pipeline fiable.',
    postes: ['Head of Growth', 'VP Marketing', 'CEO'],
    tailleStructure: '20 à 80 salariés',
    sousSecteur: 'SaaS B2B en France et en Europe',
    triggers: [
      'Levée Series A annoncée',
      'Recrute un Head of Growth',
      'Ouvre un nouveau marché',
    ],
    painPoints: [
      'Coût d’acquisition qui explose',
      'Outbound mal industrialisé',
      'Pipeline en dents de scie',
    ],
    mustHave: ['Levée < 18 mois', 'Équipe growth en place'],
    niceToHave: ['Stack moderne (HubSpot, Salesforce)', 'Présence internationale'],
    redFlags: ['Pivot en cours', 'Plan social annoncé'],
    sources: [
      'LinkedIn Sales Navigator',
      'Crunchbase',
      'Maddyness',
      'BFM Business',
    ],
    pitch:
      'J’aide les fondateurs et leurs équipes à grandir vite sans perdre ce qui les a fait démarrer : la relation et le sens.',
    benefices: [
      'Cohésion d’équipe préservée à chaque palier',
      'Posture de dirigeant renforcée',
      'Transitions de phase (seed → série A) bien vécues',
    ],
    preuves: [
      'Anywaves, Taleez, Micropep Technologies, Connektica…',
      'Coaching individuel et collectif, formation sur-mesure',
    ],
  },
  Collectivité: {
    ...EMPTY_SEGMENT_BRIEF,
    nom: 'Collectivité locale',
    description:
      'Communes et intercommunalités qui modernisent leur relation aux citoyens.',
    postes: ['DGS', 'Directeur communication', 'Adjoint au numérique'],
    tailleStructure: '10 000 à 100 000 habitants',
    sousSecteur: 'Communes & EPCI en France',
    triggers: [
      'Nouveau mandat',
      'Ouverture d’un appel d’offres',
      'Vote du budget annuel',
    ],
    painPoints: [
      'Faible participation citoyenne',
      'Outils internes vieillissants',
      'Contraintes RGPD et accessibilité',
    ],
    mustHave: ['Budget voté', 'Référent identifié'],
    niceToHave: ['Démarche France Relance', 'Conseil municipal des jeunes'],
    redFlags: ['Élections dans moins de 6 mois', 'Contentieux en cours'],
    sources: [
      'BOAMP',
      'Annuaire des collectivités',
      'Banque des Territoires',
      'Presse quotidienne régionale',
    ],
    pitch:
      'J’accompagne élus et DGS à embarquer leurs équipes dans les transformations, sans perdre personne en route.',
    benefices: [
      'Agents alignés sur le projet de mandat',
      'Conduite du changement maîtrisée',
      'Dialogue élus / services apaisé',
    ],
    preuves: [
      'Castelsarrasin, Beauzelle, Villeneuve-Tolosane…',
      'Approche relation, responsabilité, articulation individu / collectif',
    ],
  },
}
