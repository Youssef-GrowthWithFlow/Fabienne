export type ProspectStatus =
  | 'À contacter'
  | 'Contacté'
  | 'En discussion'
  | 'Sans réponse'
  | 'Refus'

export const STATUSES: ProspectStatus[] = [
  'À contacter',
  'Contacté',
  'En discussion',
  'Sans réponse',
  'Refus',
]

export const statusVariant: Record<
  ProspectStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  'À contacter': 'outline',
  Contacté: 'secondary',
  'En discussion': 'default',
  'Sans réponse': 'outline',
  Refus: 'destructive',
}

export type Segment = string
export const INITIAL_SEGMENT_IDS: Segment[] = [
  'Pharmacie',
  'Startup',
  'Collectivité',
]
export type SegmentFilter = 'all' | Segment

export type StatusFilter = 'all' | ProspectStatus

export function isStatusFilter(v: string): v is StatusFilter {
  return v === 'all' || (STATUSES as readonly string[]).includes(v)
}

export type Comment = {
  id: string
  date: string
  texte: string
}

export type Prospect = {
  id: string
  nom: string
  entreprise: string
  role: string
  segments: Segment[]
  status: ProspectStatus
  email: string
  telephone: string
  linkedin: string | null
  website: string | null
  ficheClient: string
  comments: Comment[]
}

export const FICHE_CLIENT_TEMPLATE = `
<h2>Contexte / Découverte</h2>
<p></p>
<h2>Besoins / Pain points</h2>
<p></p>
<h2>Décideurs & parties prenantes</h2>
<p></p>
<h2>Historique & prochaines étapes</h2>
<p></p>
`.trim()

export function newId(prefix = ''): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function sortComments(comments: Comment[]): Comment[] {
  return [...comments].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function latestComment(list: Comment[]): Comment | undefined {
  let max: Comment | undefined
  for (const c of list) {
    if (!max || c.date > max.date) max = c
  }
  return max
}

export const initialProspects: Prospect[] = [
  {
    id: '1',
    nom: 'Emilie Genieys',
    entreprise: 'Pharmacie Genieys',
    role: 'Pharmacien titulaire',
    segments: ['Pharmacie'],
    status: 'À contacter',
    email: 'pharmacie.gratentour@gmail.com',
    telephone: '05 61 82 37 64',
    linkedin: null,
    website: null,
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [
      {
        id: 'c1',
        date: '2026-05-13',
        texte: 'Reprise très récente (avril 2026)',
      },
    ],
  },
]
