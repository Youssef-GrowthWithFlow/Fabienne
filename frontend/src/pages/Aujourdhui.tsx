import { Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { ContactSheet } from '@/components/contact-sheet'
import { PipelineBar } from '@/components/pipeline-bar'
import { QuickLogDrawer } from '@/components/quick-log-drawer'
import { RelanceRow } from '@/components/relance-row'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { useProspects } from '@/hooks/use-prospects'
import {
  formatDate,
  isThisWeek,
  splitRelances,
  type Prospect,
} from '@/lib/prospects'

function firstName(fullName?: string, email?: string): string {
  const fromName = (fullName ?? '').trim().split(/\s+/)[0]
  if (fromName) return fromName
  const local = (email ?? '').split('@')[0]
  if (!local) return ''
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function todayLabel(): string {
  const label = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  )
}

export function Aujourdhui() {
  const { user } = useAuth()
  const { prospects, actions, loading, getProspect, updateProspect } =
    useProspects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quickLogId, setQuickLogId] = useState<string | null>(null)

  const { overdue, today, upcoming } = useMemo(
    () => splitRelances(prospects),
    [prospects],
  )

  const week = useMemo(() => {
    const sent = actions.filter(
      (a) => a.kind === 'message' && isThisWeek(a.at),
    ).length
    const replies = actions.filter(
      (a) => a.kind === 'reply' && isThisWeek(a.at),
    ).length
    const added = prospects.filter((p) => isThisWeek(p.createdAt)).length
    return { sent, replies, added }
  }, [actions, prospects])

  const selected = selectedId ? (getProspect(selectedId) ?? null) : null
  const quickLogProspect = quickLogId ? (getProspect(quickLogId) ?? null) : null

  const dueCount = overdue.length + today.length
  const prenom = firstName(user?.full_name, user?.email)

  const renderRows = (list: Prospect[], isOverdue: boolean) =>
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
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Bonjour{prenom ? ` ${prenom}` : ''} 👋
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {todayLabel()}
          {!loading && dueCount > 0
            ? ` — tu as ${dueCount} relance${dueCount > 1 ? 's' : ''} à faire.`
            : ''}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : dueCount === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-lg font-medium">
            Rien à relancer aujourd'hui 🎉
          </p>
          <p className="text-muted-foreground -mt-2 text-sm">
            Profites-en pour trouver de nouveaux prospects.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <NavLink to="/recherche">
              <Button
                size="lg"
                className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
              >
                <Sparkles className="size-4" />
                Trouver des prospects
              </Button>
            </NavLink>
            <NavLink to="/contacts">
              <Button size="lg" variant="outline" className="gap-2">
                <Users className="size-4" />
                Voir mes contacts
              </Button>
            </NavLink>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-rose-600">
                En retard ({overdue.length})
              </h3>
              <div className="space-y-3">{renderRows(overdue, true)}</div>
            </section>
          ) : null}

          {today.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">
                Aujourd'hui ({today.length})
              </h3>
              <div className="space-y-3">{renderRows(today, false)}</div>
            </section>
          ) : null}
        </div>
      )}

      {/* Ensuite cette semaine */}
      {!loading && upcoming.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-semibold">
            Ensuite cette semaine
          </h3>
          <div className="divide-border divide-y rounded-xl border">
            {upcoming.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">
                  {formatDate(p.relanceDate!)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.nom || 'Sans nom'}
                  {p.entreprise?.entreprise ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {p.entreprise.entreprise}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Ton pipeline — one-glance colored bar */}
      {!loading && prospects.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-semibold">
            Ton pipeline
          </h3>
          <PipelineBar prospects={prospects} />
        </section>
      ) : null}

      {/* Cette semaine — 3 friendly numbers */}
      {!loading ? (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-semibold">
            Cette semaine
          </h3>
          <div className="flex gap-4 rounded-xl border p-4">
            <Stat value={week.sent} label="messages envoyés" />
            <Stat value={week.replies} label="réponses reçues" />
            <Stat value={week.added} label="nouveaux contacts" />
          </div>
        </section>
      ) : null}

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
