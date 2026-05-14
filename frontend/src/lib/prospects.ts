export type ProspectStatus =
  | 'À contacter'
  | 'Contacté'
  | 'Répondu'
  | 'En discussion'
  | 'RDV'
  | 'Client'
  | 'Sans réponse'
  | 'Refus'

export const STATUSES: ProspectStatus[] = [
  'À contacter',
  'Contacté',
  'Répondu',
  'En discussion',
  'RDV',
  'Client',
  'Sans réponse',
  'Refus',
]

export const FUNNEL_STAGES: {
  key: 'prospects' | 'contacted' | 'meeting' | 'client'
  label: string
  minRank: number
}[] = [
  { key: 'prospects', label: 'Prospects', minRank: 0 },
  { key: 'contacted', label: 'Messages envoyés', minRank: 1 },
  { key: 'meeting', label: 'Rendez-vous', minRank: 4 },
  { key: 'client', label: 'Clients', minRank: 5 },
]

export const STATUS_RANK: Record<ProspectStatus, number> = {
  'À contacter': 0,
  Contacté: 1,
  Répondu: 2,
  'En discussion': 3,
  RDV: 4,
  Client: 5,
  'Sans réponse': 1,
  Refus: -1,
}

export function hasReachedRank(status: ProspectStatus, rank: number): boolean {
  if (status === 'Refus') return rank <= 0
  return STATUS_RANK[status] >= rank
}

export const statusVariant: Record<
  ProspectStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  'À contacter': 'outline',
  Contacté: 'secondary',
  Répondu: 'secondary',
  'En discussion': 'default',
  RDV: 'default',
  Client: 'default',
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

export type ActivityKind =
  | 'created'
  | 'message'
  | 'reply'
  | 'meeting'
  | 'won'
  | 'note'

export const ACTIVITY_PREFIX: Record<
  Exclude<ActivityKind, 'created' | 'note'>,
  string
> = {
  message: 'Message',
  reply: 'Réponse',
  meeting: 'RDV',
  won: 'Client',
}

export function detectActivityKind(texte: string): ActivityKind {
  const t = texte.trim()
  if (t.startsWith(ACTIVITY_PREFIX.message)) return 'message'
  if (t.startsWith(ACTIVITY_PREFIX.reply)) return 'reply'
  if (t.startsWith(ACTIVITY_PREFIX.meeting)) return 'meeting'
  if (t.startsWith(ACTIVITY_PREFIX.won)) return 'won'
  return 'note'
}

export type Prospect = {
  id: string
  nom: string
  entreprise: string
  role: string
  segment: Segment | null
  status: ProspectStatus
  email: string
  telephone: string
  linkedin: string | null
  website: string | null
  ficheClient: string
  comments: Comment[]
  createdAt: string
  contactedAt: string | null
  relanceDate: string | null
}

export const WEEKLY_GOALS = {
  newProspects: 10,
  contactedProspects: 10,
} as const

function toDate(iso: string): Date {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (day + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - diff)
  return d
}

export function isThisWeek(iso: string, ref: Date = new Date()): boolean {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return false
  const start = startOfWeek(ref)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return d >= start && d < end
}

export function countCreatedThisWeek(list: Prospect[]): number {
  return list.filter((p) => isThisWeek(p.createdAt)).length
}

export function countContactedThisWeek(list: Prospect[]): number {
  return list.filter((p) => p.contactedAt && isThisWeek(p.contactedAt)).length
}

export function isRelanceOverdue(iso: string, ref: Date = new Date()): boolean {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date(ref)
  today.setHours(0, 0, 0, 0)
  return d <= today
}

export function relancesDues(list: Prospect[]): Prospect[] {
  return list
    .filter((p) => p.relanceDate && p.status !== 'Refus')
    .sort((a, b) => (a.relanceDate! < b.relanceDate! ? -1 : 1))
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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
    segment: 'Pharmacie',
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
    createdAt: '2026-05-12',
    contactedAt: null,
    relanceDate: '2026-05-16',
  },
  {
    id: '2',
    nom: 'Julien Marchand',
    entreprise: 'Startup Nimbus',
    role: 'CEO',
    segment: 'Startup',
    status: 'Contacté',
    email: 'julien@nimbus.io',
    telephone: '06 12 34 56 78',
    linkedin: 'https://linkedin.com/in/julienmarchand',
    website: 'https://nimbus.io',
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [
      {
        id: 'c2',
        date: '2026-05-12',
        texte: 'Premier email envoyé, attente retour',
      },
    ],
    createdAt: '2026-05-11',
    contactedAt: '2026-05-12',
    relanceDate: '2026-05-14',
  },
  {
    id: '3',
    nom: 'Sophie Dubois',
    entreprise: 'Mairie de Saint-Jean',
    role: 'Responsable achats',
    segment: 'Collectivité',
    status: 'Sans réponse',
    email: 'sophie.dubois@stjean.fr',
    telephone: '05 34 12 78 90',
    linkedin: null,
    website: null,
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [
      {
        id: 'c3',
        date: '2026-05-02',
        texte: 'Relance 1 envoyée',
      },
    ],
    createdAt: '2026-04-20',
    contactedAt: '2026-04-25',
    relanceDate: '2026-05-10',
  },
  {
    id: '5',
    nom: 'Anaïs Lefèvre',
    entreprise: 'Pharmacie de la Place',
    role: 'Pharmacien titulaire',
    segment: 'Pharmacie',
    status: 'RDV',
    email: 'a.lefevre@pharm-place.fr',
    telephone: '04 22 11 33 44',
    linkedin: null,
    website: null,
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [
      {
        id: 'c5',
        date: '2026-05-09',
        texte: 'RDV confirmé pour le 22 mai',
      },
    ],
    createdAt: '2026-04-15',
    contactedAt: '2026-04-18',
    relanceDate: null,
  },
  {
    id: '6',
    nom: 'Thomas Renaud',
    entreprise: 'CleanCity SaaS',
    role: 'COO',
    segment: 'Startup',
    status: 'Client',
    email: 'thomas@cleancity.io',
    telephone: '06 99 88 77 66',
    linkedin: 'https://linkedin.com/in/thomasrenaud',
    website: 'https://cleancity.io',
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [
      {
        id: 'c6',
        date: '2026-05-05',
        texte: 'Contrat signé',
      },
    ],
    createdAt: '2026-03-20',
    contactedAt: '2026-03-22',
    relanceDate: null,
  },
  {
    id: '7',
    nom: 'Léa Marin',
    entreprise: 'Mairie de Frouzins',
    role: 'DGS',
    segment: 'Collectivité',
    status: 'Répondu',
    email: 'lea.marin@frouzins.fr',
    telephone: '05 61 78 90 12',
    linkedin: null,
    website: null,
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [
      {
        id: 'c7',
        date: '2026-05-12',
        texte: 'Intéressée, attend devis',
      },
    ],
    createdAt: '2026-05-04',
    contactedAt: '2026-05-06',
    relanceDate: '2026-05-19',
  },
  {
    id: '4',
    nom: 'Karim Belkacem',
    entreprise: 'Pharmacie du Centre',
    role: 'Pharmacien titulaire',
    segment: 'Pharmacie',
    status: 'En discussion',
    email: 'k.belkacem@pharmacie-centre.fr',
    telephone: '04 56 78 90 12',
    linkedin: null,
    website: null,
    ficheClient: FICHE_CLIENT_TEMPLATE,
    comments: [],
    createdAt: '2026-05-13',
    contactedAt: '2026-05-13',
    relanceDate: '2026-05-20',
  },
]
