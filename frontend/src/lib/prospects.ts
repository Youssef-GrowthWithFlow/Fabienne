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
  actionId?: string | null
}

export type ActivityKind =
  | 'created'
  | 'message'
  | 'reply'
  | 'discussion'
  | 'meeting'
  | 'won'
  | 'lost'
  | 'no_reply'

export type EntrepriseSummary = {
  id: string
  entreprise: string
  siteWeb: string
  ville: string
  segmentId: Segment | null
  ficheClient: string
  signaux: string[]
}

export type { FieldSource } from '@/lib/entreprises'
import type { FieldSource } from '@/lib/entreprises'

export type Prospect = {
  id: string
  nom: string
  role: string
  entrepriseId: string | null
  entreprise: EntrepriseSummary | null
  status: ProspectStatus
  email: string
  telephone: string
  linkedin: string | null
  fieldSources: Record<string, FieldSource>
  comments: Comment[]
  createdAt: string
  contactedAt: string | null
  relanceDate: string | null
}

export const WEEKLY_GOALS = {
  newProspects: 10,
  contactedProspects: 10,
  sourcedLeads: 50,
  validatedLeads: 10,
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

const WEEK_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

/** Group prospects with a `contactedAt` falling in the current week by weekday,
 *  Mon→Sun. Returns 7 entries even if some days are empty. */
export function contactedPerDayThisWeek(
  list: Prospect[],
  ref: Date = new Date(),
): { day: string; count: number }[] {
  const start = startOfWeek(ref)
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const p of list) {
    if (!p.contactedAt || !isThisWeek(p.contactedAt, ref)) continue
    const d = toDate(p.contactedAt)
    const idx = Math.floor((d.getTime() - start.getTime()) / 86_400_000)
    if (idx >= 0 && idx < 7) counts[idx] += 1
  }
  return WEEK_LABELS_FR.map((day, i) => ({ day, count: counts[i] }))
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

