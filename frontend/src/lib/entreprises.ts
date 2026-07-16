import type { Segment } from '@/lib/prospects'

export type FieldSource =
  | 'api_gouv'
  | 'ai_grounding'
  | 'ai_grounding_verified'
  | 'finess'
  | 'ordre'
  | 'google_places'
  | 'dropcontact'
  | 'manual'
  | 'gemini'

export type Dirigeant = {
  nom: string
  qualite: string
}

/** Lifecycle of a background enrichment (fiche IA, coordonnées perso). */
export type EnrichmentStatus = 'none' | 'generating' | 'ready' | 'error'

export type EntrepriseRecord = {
  id: string
  segmentId: Segment | null
  entreprise: string
  siteWeb: string
  secteur: string
  adresse: string
  codePostal: string
  ville: string
  taille: string
  linkedin: string
  origine: string
  signaux: string[]
  note: string
  ficheClient: string
  ficheStatus: EnrichmentStatus
  /** Generic company inbox (contact@, info@…) — distinct from the
   *  prospect's personal email. */
  email: string
  siren: string | null
  siret: string | null
  nafCode: string | null
  nafLabel: string | null
  effectif: string | null
  dateCreation: string | null
  dirigeants: Dirigeant[]
  telephone: string
  googlePlaceId: string
  googleMapsUrl: string
  googleRating: number | null
  googleRatingCount: number | null
  latitude: number | null
  longitude: number | null
  fieldSources: Record<string, FieldSource>
  dateAjout: string
}

export type EntrepriseSummary = {
  id: string
  entreprise: string
  siteWeb: string
  ville: string
  segmentId: Segment | null
  ficheClient: string
  ficheStatus: EnrichmentStatus
  signaux: string[]
}

export type ProposedContact = {
  nom: string
  role: string
  source?: FieldSource | null
}

export type GroundingRef = {
  title: string
  uri: string
}

export type ProposedEntreprise = {
  tempId?: string
  entreprise: string
  siteWeb: string
  secteur: string
  adresse?: string
  codePostal?: string
  ville: string
  taille: string
  raison: string
  signaux?: string[]
  contacts: ProposedContact[]
  sources?: GroundingRef[]
  siren?: string | null
  siret?: string | null
  nafCode?: string | null
  nafLabel?: string | null
  effectif?: string | null
  dateCreation?: string | null
  dirigeants?: Dirigeant[]
  telephone?: string
  googlePlaceId?: string
  googleMapsUrl?: string
  googleRating?: number | null
  googleRatingCount?: number | null
  latitude?: number | null
  longitude?: number | null
  fieldSources?: Record<string, FieldSource>
}
