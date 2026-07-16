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

/** Friendly status pills for the Contacts list — grouped so a non-technical
 *  user picks between 4 ideas, not 8 statuses. */
export const STATUS_GROUPS: {
  key: 'all' | 'a-contacter' | 'en-cours' | 'clients' | 'refus'
  label: string
  statuses: ProspectStatus[] | null
}[] = [
  { key: 'all', label: 'Tous', statuses: null },
  { key: 'a-contacter', label: 'À contacter', statuses: ['À contacter'] },
  {
    key: 'en-cours',
    label: 'En cours',
    statuses: ['Contacté', 'Répondu', 'En discussion', 'RDV', 'Sans réponse'],
  },
  { key: 'clients', label: 'Clients', statuses: ['Client'] },
  { key: 'refus', label: 'Refus', statuses: ['Refus'] },
]

export type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key']

/** Ordered pipeline steps for the visual progress dots on contact cards. */
export const PIPELINE_STEPS: ProspectStatus[] = [
  'À contacter',
  'Contacté',
  'Répondu',
  'En discussion',
  'RDV',
  'Client',
]

/** 0-based index of the furthest pipeline step reached; -1 for « Refus ».
 *  « Sans réponse » counts as « Contacté » (a message went out). */
export function pipelineRank(status: ProspectStatus): number {
  if (status === 'Refus') return -1
  if (status === 'Sans réponse') return 1
  return PIPELINE_STEPS.indexOf(status)
}

/** Contact counts per STATUS_GROUPS entry (excluding « Tous »). */
export function countByGroup(
  list: Prospect[],
): Record<Exclude<StatusGroupKey, 'all'>, number> {
  const counts = { 'a-contacter': 0, 'en-cours': 0, clients: 0, refus: 0 }
  for (const p of list) {
    for (const g of STATUS_GROUPS) {
      if (g.statuses?.includes(p.status)) {
        counts[g.key as keyof typeof counts] += 1
        break
      }
    }
  }
  return counts
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

export type { EntrepriseSummary, FieldSource } from '@/lib/entreprises'
import type { EntrepriseSummary, FieldSource } from '@/lib/entreprises'

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
  /** What to do at the next follow-up, in the user's words. */
  relanceNote: string
}

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

function dayDiffFromToday(iso: string, ref: Date = new Date()): number {
  const d = toDate(iso)
  const today = new Date(ref)
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

/** Split due relances into « en retard » (before today), « aujourd'hui »,
 *  « ensuite » (rest of the current week) and « plus tard » (beyond). */
export function splitRelances(
  list: Prospect[],
  ref: Date = new Date(),
): {
  overdue: Prospect[]
  today: Prospect[]
  upcoming: Prospect[]
  later: Prospect[]
} {
  const dues = relancesDues(list)
  const overdue: Prospect[] = []
  const today: Prospect[] = []
  const upcoming: Prospect[] = []
  const later: Prospect[] = []
  for (const p of dues) {
    const diff = dayDiffFromToday(p.relanceDate!, ref)
    if (diff < 0) overdue.push(p)
    else if (diff === 0) today.push(p)
    else if (isThisWeek(p.relanceDate!, ref)) upcoming.push(p)
    else later.push(p)
  }
  return { overdue, today, upcoming, later }
}

/** Active contacts (not won, not lost) with no follow-up planned — the ones
 *  at risk of being forgotten. */
export function sansRelance(list: Prospect[]): Prospect[] {
  return list.filter(
    (p) =>
      !p.relanceDate &&
      p.status !== 'Client' &&
      p.status !== 'Refus',
  )
}

/** ISO date shifted by `days` from today (used by « Plus tard »). */
export function isoInDays(days: number, ref: Date = new Date()): string {
  const d = new Date(ref)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const WEEKDAYS_FR = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Human date phrase: « Aujourd'hui », « Demain », « Jeudi », « Lundi
 *  prochain », « Le 15/08/2026 », or « En retard depuis le 06/07/2026 ». */
export function relanceLabel(iso: string, ref: Date = new Date()): string {
  const diff = dayDiffFromToday(iso, ref)
  if (diff < 0) return `En retard depuis le ${formatDate(iso)}`
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  const d = toDate(iso)
  const weekday = WEEKDAYS_FR[d.getDay()]
  if (diff < 7) {
    return isThisWeek(iso, ref)
      ? capitalize(weekday)
      : `${capitalize(weekday)} prochain`
  }
  if (diff < 14) return `${capitalize(weekday)} prochain`
  return `Le ${formatDate(iso)}`
}

/** The task as a sentence: « Demain, je dois envoyer ma proposition. » —
 *  falls back to « …je dois relancer {nom} » when no note was written. */
export function taskSentence(p: Prospect): { when: string; what: string } {
  const when = p.relanceDate ? relanceLabel(p.relanceDate) : ''
  const what =
    p.relanceNote.trim() ||
    `relancer ${p.nom || p.entreprise?.entreprise || 'ce contact'}`
  return { when, what }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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

