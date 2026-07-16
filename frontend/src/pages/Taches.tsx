import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  List,
  PartyPopper,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ContactSheet } from '@/components/contact-sheet'
import { QuickLogDrawer } from '@/components/quick-log-drawer'
import { RelanceRow } from '@/components/relance-row'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useProspects } from '@/hooks/use-prospects'
import {
  formatDate,
  isRelanceOverdue,
  isoInDays,
  sansRelance,
  splitRelances,
  todayIso,
  type Prospect,
} from '@/lib/prospects'
import { cn } from '@/lib/utils'

type TachesView = 'liste' | 'planning'

function SectionTitle({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone?: 'danger' | 'muted'
}) {
  return (
    <h3
      className={cn(
        'text-sm font-semibold',
        tone === 'danger' && 'text-rose-600',
        tone === 'muted' && 'text-muted-foreground',
      )}
    >
      {label} ({count})
    </h3>
  )
}

/** Row for a contact with no planned follow-up: say what + when. */
function PlanRow({
  prospect,
  onOpen,
}: {
  prospect: Prospect
  onOpen: () => void
}) {
  const { updateProspect } = useProspects()
  const [note, setNote] = useState('')

  const plan = (iso: string) => {
    if (!iso) return
    updateProspect({
      ...prospect,
      relanceDate: iso,
      relanceNote: note.trim() || prospect.relanceNote,
    })
    toast.success(`C'est noté pour le ${formatDate(iso)}.`)
  }

  return (
    <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4 shadow-xs">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 basis-44 text-left"
      >
        <div className="truncate text-base font-semibold">
          {prospect.nom || 'Sans nom'}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {[prospect.entreprise?.entreprise, prospect.status]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </button>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Je dois… (ex : envoyer ma proposition)"
          className="h-8 w-56 !text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => plan(isoInDays(1))}
          className="gap-1.5"
        >
          <CalendarPlus className="size-3.5" />
          Demain
        </Button>
        <Input
          type="date"
          onChange={(e) => plan(e.target.value)}
          className="h-8 w-fit !text-sm"
          aria-label="Choisir une date de relance"
        />
      </div>
    </div>
  )
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Month planning: one cell per day, with the follow-ups as clickable chips. */
function PlanningView({
  prospects,
  onOpen,
}: {
  prospects: Prospect[]
  onOpen: (id: string) => void
}) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const byDay = useMemo(() => {
    const map = new Map<string, Prospect[]>()
    for (const p of prospects) {
      if (!p.relanceDate || p.status === 'Refus') continue
      const list = map.get(p.relanceDate) ?? []
      list.push(p)
      map.set(p.relanceDate, list)
    }
    return map
  }, [prospects])

  const cells = useMemo(() => {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const firstWeekday = (monthStart.getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = []
    for (let i = 0; i < firstWeekday; i++) out.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      )
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [monthStart])

  const today = todayIso()
  const shiftMonth = (delta: number) =>
    setMonthStart(
      (m) => new Date(m.getFullYear(), m.getMonth() + delta, 1),
    )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => shiftMonth(-1)}
          aria-label="Mois précédent"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">
          {MONTHS_FR[monthStart.getMonth()]} {monthStart.getFullYear()}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="bg-muted/40 grid grid-cols-7 border-b">
          {WEEKDAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-muted-foreground px-2 py-1.5 text-center text-xs font-medium"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, i) => {
            const tasks = iso ? (byDay.get(iso) ?? []) : []
            const isToday = iso === today
            return (
              <div
                key={i}
                className={cn(
                  'min-h-20 border-r border-b p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                  !iso && 'bg-muted/20',
                  isToday && 'bg-sky-50 dark:bg-sky-950/30',
                )}
              >
                {iso ? (
                  <>
                    <div
                      className={cn(
                        'px-1 text-[11px] tabular-nums',
                        isToday
                          ? 'font-bold text-sky-700 dark:text-sky-300'
                          : 'text-muted-foreground',
                      )}
                    >
                      {Number(iso.slice(8, 10))}
                    </div>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {tasks.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onOpen(p.id)}
                          title={
                            p.relanceNote
                              ? `${p.nom} — ${p.relanceNote}`
                              : p.nom
                          }
                          className={cn(
                            'truncate rounded px-1 py-0.5 text-left text-[11px] font-medium',
                            isRelanceOverdue(iso) && iso < today
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
                          )}
                        >
                          {p.nom || p.entreprise?.entreprise || '?'}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Clique sur un nom pour ouvrir le contact — survole pour voir la tâche.
      </p>
    </div>
  )
}

export function Taches() {
  const { prospects, loading, getProspect, updateProspect } = useProspects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quickLogId, setQuickLogId] = useState<string | null>(null)
  const [view, setView] = useState<TachesView>('liste')

  const { overdue, today, upcoming, later } = useMemo(
    () => splitRelances(prospects),
    [prospects],
  )
  const aPlanifier = useMemo(() => sansRelance(prospects), [prospects])

  const selected = selectedId ? (getProspect(selectedId) ?? null) : null
  const quickLogProspect = quickLogId ? (getProspect(quickLogId) ?? null) : null
  const totalPlanned =
    overdue.length + today.length + upcoming.length + later.length

  const renderRows = (list: Prospect[], isOverdue = false) =>
    list.map((p) => (
      <RelanceRow
        key={p.id}
        prospect={p}
        overdue={isOverdue}
        onOpen={() => setSelectedId(p.id)}
        onDone={() => setQuickLogId(p.id)}
      />
    ))

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tes tâches</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Toutes tes relances au même endroit — fais, repousse ou planifie.
          </p>
        </div>
        <div className="bg-muted/40 flex rounded-lg border p-0.5">
          {(
            [
              { key: 'liste', label: 'Liste', icon: List },
              { key: 'planning', label: 'Planning', icon: CalendarDays },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                view === v.key
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : view === 'planning' ? (
        <PlanningView
          prospects={prospects}
          onOpen={(id) => setSelectedId(id)}
        />
      ) : (
        <>
          {totalPlanned === 0 && aPlanifier.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
              <PartyPopper className="text-muted-foreground size-6" />
              <p className="text-lg font-medium">Aucune tâche en attente.</p>
              <p className="text-muted-foreground text-sm">
                Tout est à jour — va chercher de nouveaux prospects !
              </p>
            </div>
          ) : null}

          {overdue.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle label="En retard" count={overdue.length} tone="danger" />
              <div className="space-y-3">{renderRows(overdue, true)}</div>
            </section>
          ) : null}

          {today.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle label="Aujourd'hui" count={today.length} />
              <div className="space-y-3">{renderRows(today)}</div>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle label="Cette semaine" count={upcoming.length} />
              <div className="space-y-3">{renderRows(upcoming)}</div>
            </section>
          ) : null}

          {later.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle label="Plus tard" count={later.length} tone="muted" />
              <div className="space-y-3">{renderRows(later)}</div>
            </section>
          ) : null}

          {aPlanifier.length > 0 ? (
            <section className="space-y-3">
              <div>
                <SectionTitle
                  label="À planifier"
                  count={aPlanifier.length}
                  tone="muted"
                />
                <p className="text-muted-foreground text-xs">
                  Ces contacts n'ont pas de prochaine relance — dis quoi faire
                  et quand, pour ne pas les oublier.
                </p>
              </div>
              <div className="space-y-3">
                {aPlanifier.map((p) => (
                  <PlanRow
                    key={p.id}
                    prospect={p}
                    onOpen={() => setSelectedId(p.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <QuickLogDrawer
        prospect={quickLogProspect}
        onClose={() => setQuickLogId(null)}
      />

      {selected ? (
        <ContactSheet
          prospect={selected}
          onClose={() => setSelectedId(null)}
          onChange={updateProspect}
        />
      ) : null}
    </>
  )
}
