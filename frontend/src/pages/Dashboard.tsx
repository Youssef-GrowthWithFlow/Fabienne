import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'

import { ContactsBar } from '@/components/dashboard/contacts-bar'
import { SourcingRadial } from '@/components/dashboard/sourcing-radial'
import { ProspectSheet } from '@/components/prospect-sheet'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useActions } from '@/hooks/use-actions'
import { useProspects } from '@/hooks/use-prospects'
import { useSegments } from '@/hooks/use-segments'
import { useSourcerHistory } from '@/hooks/use-sourcer-history'
import {
  FUNNEL_STAGES,
  WEEKLY_GOALS,
  contactedPerDayThisWeek,
  countContactedThisWeek,
  hasReachedRank,
  isThisWeek,
  isRelanceOverdue,
  relancesDues,
  startOfWeek,
  statusVariant,
  type ActivityKind,
  type Prospect,
  type ProspectStatus,
  type SegmentFilter,
} from '@/lib/prospects'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const KANBAN_STATUSES: ProspectStatus[] = [
  'À contacter',
  'Contacté',
  'Répondu',
  'En discussion',
  'RDV',
]

type Period = '7' | '30' | '90' | 'all'
const PERIOD_LABEL: Record<Period, string> = {
  '7': '7 jours',
  '30': '30 jours',
  '90': '90 jours',
  all: 'Tout',
}
const PERIODS: Period[] = ['7', '30', '90', 'all']

function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayLabel(d: Date, todayIso: string): string {
  const iso = isoDay(d)
  if (iso === todayIso) return "Aujourd'hui"
  const tomorrow = new Date(d)
  tomorrow.setDate(d.getDate() - 1)
  if (isoDay(tomorrow) === todayIso) return 'Demain'
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function OverdueBlock({
  overdue,
  onOpen,
}: {
  overdue: Prospect[]
  onOpen: (id: string) => void
}) {
  if (overdue.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-emerald-600" />
        Aucune relance en retard.
      </div>
    )
  }
  return (
    <ul className="divide-y">
      {overdue.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onOpen(p.id)}
            className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.nom}</p>
              <p className="text-muted-foreground truncate text-xs">
                {p.entreprise?.entreprise ?? ""}
              </p>
            </div>
            <span className="text-xs font-medium text-rose-400 tabular-nums dark:text-rose-300">
              {new Date(p.relanceDate!).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function WeekList({
  prospects,
  onOpen,
}: {
  prospects: Prospect[]
  onOpen: (id: string) => void
}) {
  const today = useMemo(() => new Date(), [])
  const todayIso = isoDay(today)

  const grouped = useMemo(() => {
    const start = startOfWeek(today)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    const items = prospects
      .filter((p) => {
        if (!p.relanceDate) return false
        const d = new Date(p.relanceDate)
        return d >= start && d < end && !isRelanceOverdue(p.relanceDate)
      })
      .sort((a, b) => (a.relanceDate! < b.relanceDate! ? -1 : 1))

    const map = new Map<string, Prospect[]>()
    for (const p of items) {
      const key = p.relanceDate!.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.entries())
  }, [prospects, today])

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune relance prévue cette semaine.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(([iso, items]) => {
        const d = new Date(`${iso}T00:00:00`)
        return (
          <div key={iso} className="flex flex-col gap-1">
            <div className="text-muted-foreground flex items-baseline gap-2 text-xs uppercase tracking-wide">
              <span className="font-medium">{dayLabel(d, todayIso)}</span>
            </div>
            <ul className="divide-y">
              {items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.nom}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {p.entreprise?.entreprise ?? ""}
                      </p>
                    </div>
                    <Badge
                      variant={statusVariant[p.status]}
                      className="shrink-0"
                    >
                      {p.status}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

type ActivityItem = {
  type: ActivityKind
  iso: string
  prospectId: string
  prospect: string
  texte?: string
}

const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  created: 'Nouveau',
  message: 'Message',
  reply: 'Réponse',
  discussion: 'Discussion',
  meeting: 'RDV',
  won: 'Client',
  lost: 'Refus',
  no_reply: 'Sans réponse',
}

const ACTIVITY_BADGE: Record<ActivityKind, string> = {
  created:
    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  message:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  reply:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  discussion:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  meeting:
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  won:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  lost:
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  no_reply:
    'bg-muted text-muted-foreground',
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const activityChartConfig = {
  count: { label: 'Actions', color: '#10b981' },
} satisfies ChartConfig

function ActivityTracker({
  prospects,
  onOpenProspect,
}: {
  prospects: Prospect[]
  onOpenProspect: (id: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const [weekDetail, setWeekDetail] = useState<{
    start: Date
    items: ActivityItem[]
  } | null>(null)

  const { actions } = useActions()

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, ActivityItem[]>()
    const byId = new Map(prospects.map((p) => [p.id, p]))
    for (const a of actions) {
      const iso = a.at.slice(0, 10)
      const list = map.get(iso) ?? []
      list.push({
        type: a.kind,
        iso,
        prospectId: a.prospectId,
        prospect: byId.get(a.prospectId)?.nom || 'Sans nom',
      })
      map.set(iso, list)
    }
    return map
  }, [actions, prospects])

  const { days, total, weekStart, weekItems, rangeLabel } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monday = startOfWeek(today)
    const weekStart = new Date(monday)
    weekStart.setDate(monday.getDate() - offset * 7)

    const days = []
    const weekItems: ActivityItem[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      const iso = isoDay(d)
      const items = activitiesByDay.get(iso) ?? []
      weekItems.push(...items)
      const breakdown: Partial<Record<ActivityKind, number>> = {}
      for (const it of items) breakdown[it.type] = (breakdown[it.type] ?? 0) + 1
      days.push({
        day: DAY_LABELS[i],
        fullDate: d.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        count: items.length,
        breakdown,
      })
    }

    const total = weekItems.length
    const fmt = (d: Date) =>
      d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const rangeLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`
    return { days, total, weekStart, weekItems, rangeLabel }
  }, [activitiesByDay, offset])

  const weekLabel = offset === 0 ? 'Cette semaine' : rangeLabel

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{weekLabel}</p>
          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-semibold tabular-nums">
              {total}
            </span>{' '}
            action{total > 1 ? 's' : ''} · {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Semaine précédente"
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Semaine suivante"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <ChartContainer config={activityChartConfig} className="h-56 w-full">
        <BarChart
          data={days}
          margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
          onClick={() =>
            setWeekDetail({ start: weekStart, items: weekItems })
          }
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={24}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullDate ?? ''
                }
                formatter={(value, _name, item) => {
                  const breakdown = (
                    item.payload as { breakdown?: Partial<Record<ActivityKind, number>> }
                  )?.breakdown
                  const parts = breakdown
                    ? (Object.entries(breakdown) as [ActivityKind, number][])
                        .filter(([, n]) => n > 0)
                        .map(([k, n]) => `${n} ${ACTIVITY_LABEL[k].toLowerCase()}`)
                    : []
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span>
                        <span className="font-medium tabular-nums">
                          {value as number}
                        </span>{' '}
                        action{(value as number) > 1 ? 's' : ''}
                      </span>
                      {parts.length > 0 ? (
                        <span className="text-muted-foreground text-[11px]">
                          {parts.join(' · ')}
                        </span>
                      ) : null}
                    </div>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[6, 6, 0, 0]}
            className="cursor-pointer"
          />
        </BarChart>
      </ChartContainer>

      <ActivityWeekSheet
        detail={weekDetail}
        onClose={() => setWeekDetail(null)}
        onOpenProspect={onOpenProspect}
      />
    </div>
  )
}

function ActivityWeekSheet({
  detail,
  onClose,
  onOpenProspect,
}: {
  detail: { start: Date; items: ActivityItem[] } | null
  onClose: () => void
  onOpenProspect: (id: string) => void
}) {
  if (!detail) return null
  const end = new Date(detail.start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  const items = [...detail.items].sort((a, b) => (a.iso < b.iso ? -1 : 1))

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[60vw]"
      >
        <div className="border-b px-4 py-4 sm:px-6">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Activité
          </p>
          <h3 className="text-lg font-semibold">
            {fmt(detail.start)} – {fmt(end)}
          </h3>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {detail.items.length}
            <span className="text-muted-foreground ml-1 text-base font-medium">
              action{detail.items.length > 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm italic">
              Aucune activité cette semaine.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {items.map((a, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenProspect(a.prospectId)
                      }}
                      className="bg-card hover:bg-muted/40 flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                            ACTIVITY_BADGE[a.type],
                          )}
                        >
                          {ACTIVITY_LABEL[a.type]}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {new Date(`${a.iso}T00:00:00`).toLocaleDateString(
                            'fr-FR',
                            { weekday: 'short', day: '2-digit', month: 'short' },
                          )}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{a.prospect}</p>
                      {a.texte ? (
                        <p className="text-muted-foreground text-xs">
                          {a.texte}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden rounded-xl border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((a, i) => (
                      <TableRow
                        key={i}
                        className="cursor-pointer"
                        onClick={() => {
                          onClose()
                          onOpenProspect(a.prospectId)
                        }}
                      >
                        <TableCell className="text-muted-foreground tabular-nums">
                          {new Date(`${a.iso}T00:00:00`).toLocaleDateString(
                            'fr-FR',
                            { weekday: 'short', day: '2-digit', month: 'short' },
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                              ACTIVITY_BADGE[a.type],
                            )}
                          >
                            {ACTIVITY_LABEL[a.type]}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {a.prospect}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.texte ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function KanbanBoard({
  prospects,
  onOpen,
}: {
  prospects: Prospect[]
  onOpen: (id: string) => void
}) {
  const byStatus = useMemo(() => {
    const map: Record<ProspectStatus, Prospect[]> = {
      'À contacter': [],
      Contacté: [],
      Répondu: [],
      'En discussion': [],
      RDV: [],
      Client: [],
      'Sans réponse': [],
      Refus: [],
    }
    for (const p of prospects) map[p.status].push(p)
    return map
  }, [prospects])

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:snap-none sm:px-0 sm:pb-0">
      {KANBAN_STATUSES.map((status) => {
        const items = byStatus[status]
        return (
          <div
            key={status}
            className="bg-muted/40 flex w-[16rem] shrink-0 snap-start flex-col gap-2 rounded-lg p-2 sm:w-72"
          >
            <div className="flex items-center justify-between px-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{status}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {items.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.length === 0 ? (
                <p className="text-muted-foreground/60 px-2 py-3 text-xs">
                  Vide
                </p>
              ) : (
                items.map((p) => {
                  const latest = p.comments.length > 0 ? p.comments[0] : null
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="bg-card hover:bg-card/80 flex flex-col gap-1 rounded-md border-0 p-2.5 text-left shadow-xs ring-1 ring-black/5 transition-colors dark:ring-white/5"
                    >
                      <span className="truncate text-sm font-medium">
                        {p.nom || 'Sans nom'}
                      </span>
                      {p.entreprise?.entreprise ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {p.entreprise.entreprise}
                        </span>
                      ) : null}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {p.entreprise?.segmentId ? (
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] font-normal"
                          >
                            {p.entreprise.segmentId}
                          </Badge>
                        ) : null}
                        {p.relanceDate ? (
                          <span className="text-muted-foreground text-[10px] tabular-nums">
                            ↻{' '}
                            {new Date(p.relanceDate).toLocaleDateString(
                              'fr-FR',
                              { day: '2-digit', month: 'short' },
                            )}
                          </span>
                        ) : null}
                      </div>
                      {latest ? (
                        <p className="text-muted-foreground line-clamp-1 text-[11px]">
                          {latest.texte}
                        </p>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FunnelView({
  prospects,
  onOpenProspect,
}: {
  prospects: Prospect[]
  onOpenProspect: (id: string) => void
}) {
  const stages = useMemo(
    () =>
      FUNNEL_STAGES.map((s) => {
        const matching = prospects.filter((p) =>
          hasReachedRank(p.status, s.minRank),
        )
        return { ...s, count: matching.length, matching }
      }),
    [prospects],
  )
  const top = Math.max(1, stages[0].count)

  const [detail, setDetail] = useState<{
    label: string
    count: number
    conversion: number | null
    prospects: Prospect[]
  } | null>(null)

  return (
    <TooltipProvider delay={120}>
      <div className="flex flex-col gap-2">
        {stages.map((s, i) => {
          const ratio = top > 0 ? s.count / top : 0
          const prev = i > 0 ? stages[i - 1].count : null
          const conversion =
            prev && prev > 0 ? Math.round((s.count / prev) * 100) : null
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() =>
                      setDetail({
                        label: s.label,
                        count: s.count,
                        conversion,
                        prospects: s.matching,
                      })
                    }
                    className="hover:bg-muted/40 group flex w-full cursor-pointer flex-col gap-1 rounded-md p-1 text-left transition-colors"
                  />
                }
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{s.count}</span>
                    {conversion !== null ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {conversion}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.max(ratio * 100, s.count > 0 ? 3 : 0)}%`,
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {s.label} · {s.count}
                  </span>
                  {i === 0 ? (
                    <span className="text-background/70 text-[11px]">
                      Total entrée du funnel
                    </span>
                  ) : (
                    <span className="text-background/70 text-[11px]">
                      {conversion}% conv. · {Math.round((s.count / top) * 100)}%
                      du top
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <FunnelStageSheet
        detail={detail}
        onClose={() => setDetail(null)}
        onOpenProspect={onOpenProspect}
      />
    </TooltipProvider>
  )
}

function FunnelStageSheet({
  detail,
  onClose,
  onOpenProspect,
}: {
  detail: {
    label: string
    count: number
    conversion: number | null
    prospects: Prospect[]
  } | null
  onClose: () => void
  onOpenProspect: (id: string) => void
}) {
  if (!detail) return null
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[60vw]"
      >
        <div className="border-b px-4 py-4 sm:px-6">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Étape du funnel
          </p>
          <h3 className="text-lg font-semibold">{detail.label}</h3>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {detail.count}
            <span className="text-muted-foreground ml-1 text-base font-medium">
              prospect{detail.count > 1 ? 's' : ''}
            </span>
            {detail.conversion !== null ? (
              <span className="text-muted-foreground ml-3 text-sm font-medium">
                · {detail.conversion}% de conversion
              </span>
            ) : null}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {detail.prospects.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm italic">
              Aucun prospect à cette étape.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {detail.prospects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenProspect(p.id)
                      }}
                      className="bg-card hover:bg-muted/40 flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left shadow-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.nom}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {p.entreprise?.entreprise ?? ""}
                        </p>
                      </div>
                      <Badge
                        variant={statusVariant[p.status]}
                        className="shrink-0"
                      >
                        {p.status}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden rounded-xl border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead className="text-right">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.prospects.map((p) => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => {
                          onClose()
                          onOpenProspect(p.id)
                        }}
                      >
                        <TableCell className="font-medium">{p.nom}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.entreprise?.entreprise ?? ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={statusVariant[p.status]}>
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ActivityStats({
  prospects,
  onOpenProspect,
}: {
  prospects: Prospect[]
  onOpenProspect: (id: string) => void
}) {
  const [period, setPeriod] = useState<Period>('30')
  const [segment, setSegment] = useState<SegmentFilter>('all')
  const { segments, briefs } = useSegments()

  const filtered = useMemo(() => {
    const start =
      period === 'all'
        ? null
        : (() => {
            const d = new Date()
            d.setHours(0, 0, 0, 0)
            d.setDate(d.getDate() - Number(period))
            return d
          })()
    return {
      list: prospects.filter((p) => {
        if (segment !== 'all' && (p.entreprise?.segmentId ?? null) !== segment)
          return false
        if (start) {
          const d = new Date(p.createdAt)
          if (Number.isNaN(d.getTime()) || d < start) return false
        }
        return true
      }),
    }
  }, [prospects, period, segment])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-muted/60 inline-flex rounded-md p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <Select
          value={segment}
          onValueChange={(v) => typeof v === 'string' && setSegment(v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {(value: unknown) =>
                value === 'all'
                  ? 'Tous les segments'
                  : briefs[String(value)]?.nom ?? String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les segments</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s} value={s}>
                {briefs[s]?.nom ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-base font-semibold tracking-tight">Funnel</h4>
          <p className="text-muted-foreground text-xs">
            Statut atteint à ce jour
          </p>
        </div>
        <FunnelView
          prospects={filtered.list}
          onOpenProspect={onOpenProspect}
        />
      </div>
    </div>
  )
}

export function Dashboard() {
  const { prospects, loading, getProspect, updateProspect } = useProspects()
  const { candidates: sourcerCandidates } = useSourcerHistory()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const contacted = countContactedThisWeek(prospects)

  // Sourcing : tout candidat sourcé cette semaine (peu importe le statut)
  // vs validés (status = 'validated'). On compte les SourcedCandidate
  // récupérés depuis l'API sourcer.
  const sourcedThisWeek = useMemo(
    () => sourcerCandidates.filter((c) => isThisWeek(c.createdAt)).length,
    [sourcerCandidates],
  )
  const validatedThisWeek = useMemo(
    () =>
      sourcerCandidates.filter(
        (c) => c.status === 'validated' && isThisWeek(c.createdAt),
      ).length,
    [sourcerCandidates],
  )
  const contactsPerDay = useMemo(
    () => contactedPerDayThisWeek(prospects),
    [prospects],
  )
  const relances = relancesDues(prospects)
  const overdue = relances.filter(
    (p) => p.relanceDate && isRelanceOverdue(p.relanceDate),
  )

  const selected = selectedId ? (getProspect(selectedId) ?? null) : null
  const openProspect = (id: string) => setSelectedId(id)

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Objectifs, relances, pipeline et suivi de l'activité.
        </p>
      </div>

      <Tabs defaultValue="hebdo" className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="hebdo">Suivi Hebdo</TabsTrigger>
          <TabsTrigger value="activite">Suivi de l'activité</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="hebdo" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold tracking-tight">
          Objectifs hebdo
        </h3>
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {loading ? (
            <>
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </>
          ) : (
            <>
              <SourcingRadial
                sourced={sourcedThisWeek}
                sourcedTarget={WEEKLY_GOALS.sourcedLeads}
                validated={validatedThisWeek}
                validatedTarget={WEEKLY_GOALS.validatedLeads}
              />
              <ContactsBar
                perDay={contactsPerDay}
                total={contacted}
                target={WEEKLY_GOALS.contactedProspects}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-rose-400 dark:text-rose-300" />
          <h3 className="text-lg font-semibold tracking-tight text-rose-500 dark:text-rose-300">
            En retard
          </h3>
        </div>
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <OverdueBlock overdue={overdue} onOpen={openProspect} />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold tracking-tight">
          Relances de la semaine
        </h3>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <WeekList prospects={prospects} onOpen={openProspect} />
        )}
      </div>

        </TabsContent>

        <TabsContent value="activite" className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold tracking-tight">Activité</h3>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ActivityTracker
                prospects={prospects}
                onOpenProspect={openProspect}
              />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold tracking-tight">Pipeline</h3>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <KanbanBoard prospects={prospects} onOpen={openProspect} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="flex flex-col gap-6">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ActivityStats
              prospects={prospects}
              onOpenProspect={openProspect}
            />
          )}
        </TabsContent>
      </Tabs>

      {selected ? (
        <ProspectSheet
          prospect={selected}
          onClose={() => setSelectedId(null)}
          onChange={updateProspect}
        />
      ) : null}
    </>
  )
}
