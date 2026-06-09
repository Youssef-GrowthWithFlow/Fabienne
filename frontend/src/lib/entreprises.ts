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
  ca: string
  linkedin: string
  score: string
  origine: string
  signaux: string[]
  note: string
  ficheClient: string
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

export type GenerateResponse = {
  candidates: ProposedEntreprise[]
  searchQueries: string[]
  grounding: GroundingRef[]
}
