export type AISource = {
  url: string
  description: string
}

export type SegmentBrief = {
  nom: string
  description: string
  postes: string[]
  tailleStructure: string
  activiteCiblee: string[]
  zoneGeographique: string[]
  painPoints: string[]
  mustHave: string[]
  shouldHave: string[]
  redFlags: string[]
  sources: string[]
  pitch: string
  benefices: string[]
  preuves: string[]
  notes: string
  dataSources: string[]
  aiSources: AISource[]
}

export const EMPTY_SEGMENT_BRIEF: SegmentBrief = {
  nom: '',
  description: '',
  postes: [],
  tailleStructure: '',
  activiteCiblee: [],
  zoneGeographique: [],
  painPoints: [],
  mustHave: [],
  shouldHave: [],
  redFlags: [],
  sources: [],
  pitch: '',
  benefices: [],
  preuves: [],
  notes: '',
  dataSources: [],
  aiSources: [],
}

export const DATA_SOURCE_OPTIONS: {
  value: string
  label: string
  description: string
}[] = [
  {
    value: 'finess',
    label: 'FINESS',
    description:
      'Référentiel data.gouv.fr des établissements sanitaires, sociaux et médico-sociaux (pharmacies, EHPAD, hôpitaux, cliniques, IME…). À activer pour les segments à caractère Sanitaire, Social ou Médico-Social.',
  },
  {
    value: 'ordre_pharmaciens',
    label: 'Ordre des Pharmaciens',
    description:
      "Annuaire officiel du CNOP ingéré localement (officines, pharmaciens titulaires et adjoints avec leur fonction exacte). À activer pour le segment Pharmacie : court-circuite la recherche IA et renvoie directement la liste complète de l'équipe de chaque officine.",
  },
]
