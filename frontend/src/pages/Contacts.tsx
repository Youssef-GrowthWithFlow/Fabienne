import {
  Building2,
  CalendarClock,
  Columns3,
  List,
  Plus,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { ContactSheet } from '@/components/contact-sheet'
import {
  CreateContactDrawer,
  type CreateContactInput,
} from '@/components/create-contact-drawer'
import { GROUP_COLORS } from '@/lib/group-colors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import {
  PIPELINE_STEPS,
  STATUS_GROUPS,
  countByGroup,
  formatDate,
  isRelanceOverdue,
  latestComment,
  pipelineRank,
  statusVariant,
  type Prospect,
  type StatusGroupKey,
} from '@/lib/prospects'
import { cn } from '@/lib/utils'

/** Six little dots — where this contact stands in the pipeline, at a glance. */
function PipelineDots({ status }: { status: Prospect['status'] }) {
  const rank = pipelineRank(status)
  if (rank < 0) {
    return (
      <span className="text-xs font-medium text-rose-500">✕ Refus</span>
    )
  }
  const won = status === 'Client'
  return (
    <span className="flex items-center gap-1" title={status}>
      {PIPELINE_STEPS.map((step, i) => (
        <span
          key={step}
          className={cn(
            'size-1.5 rounded-full',
            i <= rank
              ? won
                ? 'bg-emerald-500'
                : 'bg-sky-500'
              : 'bg-border',
          )}
        />
      ))}
    </span>
  )
}

function ContactCard({ p, onClick }: { p: Prospect; onClick: () => void }) {
  const latest = latestComment(p.comments)
  const relanceDue = p.relanceDate && isRelanceOverdue(p.relanceDate)
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:bg-muted/40 focus-visible:ring-ring flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-2"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-base font-semibold">
              {p.nom || 'Sans nom'}
            </h3>
            <PipelineDots status={p.status} />
          </div>
          <p className="text-muted-foreground truncate text-sm">
            {[p.entreprise?.entreprise, p.entreprise?.ville]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
          {p.relanceDate ? (
            <span
              className={cn(
                'flex items-center gap-1 text-xs tabular-nums',
                relanceDue ? 'font-medium text-rose-600' : 'text-muted-foreground',
              )}
            >
              <CalendarClock className="size-3" />
              {formatDate(p.relanceDate)}
            </span>
          ) : null}
        </div>
      </header>

      {latest ? (
        <p className="text-muted-foreground line-clamp-1 text-sm">
          {latest.texte}
        </p>
      ) : null}
    </button>
  )
}

function ContactCardSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}

type ContactsView = 'liste' | 'pipeline' | 'entreprises'

const VIEWS: { key: ContactsView; label: string; icon: typeof List }[] = [
  { key: 'liste', label: 'Liste', icon: List },
  { key: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { key: 'entreprises', label: 'Par entreprise', icon: Building2 },
]

/** Compact row used inside pipeline columns and company groups. */
function MiniContactRow({ p, onClick }: { p: Prospect; onClick: () => void }) {
  const relanceDue = p.relanceDate && isRelanceOverdue(p.relanceDate)
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:bg-muted/40 flex w-full flex-col gap-0.5 rounded-lg border p-2.5 text-left shadow-xs transition-colors"
    >
      <span className="truncate text-sm font-medium">
        {p.nom || 'Sans nom'}
      </span>
      <span className="text-muted-foreground truncate text-xs">
        {p.entreprise?.entreprise ?? ''}
      </span>
      {p.relanceDate ? (
        <span
          className={cn(
            'flex items-center gap-1 text-[11px] tabular-nums',
            relanceDue ? 'font-medium text-rose-600' : 'text-muted-foreground',
          )}
        >
          <CalendarClock className="size-3" />
          {formatDate(p.relanceDate)}
        </span>
      ) : null}
    </button>
  )
}

function PipelineView({
  prospects,
  onOpen,
}: {
  prospects: Prospect[]
  onOpen: (id: string) => void
}) {
  const columns = STATUS_GROUPS.filter((g) => g.key !== 'all')
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((g) => {
        const items = prospects.filter((p) => g.statuses!.includes(p.status))
        const color = GROUP_COLORS[g.key]
        return (
          <div
            key={g.key}
            className="bg-muted/20 w-60 shrink-0 rounded-xl border p-2.5"
          >
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className={cn('size-2 rounded-full', color.dot)} />
              <span className="text-sm font-medium">{g.label}</span>
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <p className="text-muted-foreground px-1 py-3 text-center text-xs italic">
                  Personne ici.
                </p>
              ) : (
                items.map((p) => (
                  <MiniContactRow key={p.id} p={p} onClick={() => onOpen(p.id)} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EntreprisesView({
  prospects,
  onOpen,
}: {
  prospects: Prospect[]
  onOpen: (id: string) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { nom: string; ville: string; items: Prospect[] }>()
    for (const p of prospects) {
      const key = p.entrepriseId ?? '—'
      const entry = map.get(key) ?? {
        nom: p.entreprise?.entreprise ?? 'Sans entreprise',
        ville: p.entreprise?.ville ?? '',
        items: [],
      }
      entry.items.push(p)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [prospects])

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.nom} className="rounded-xl border">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <Building2 className="text-muted-foreground size-4" />
            <span className="truncate text-sm font-semibold">{g.nom}</span>
            {g.ville ? (
              <span className="text-muted-foreground text-xs">· {g.ville}</span>
            ) : null}
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
              {g.items.length} contact{g.items.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-border divide-y">
            {g.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p.id)}
                className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.nom || 'Sans nom'}
                  {p.role ? (
                    <span className="text-muted-foreground"> · {p.role}</span>
                  ) : null}
                </span>
                <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Contacts() {
  const { prospects, loading, getProspect, updateProspect, createProspect } =
    useProspects()
  const { refresh: refreshEntreprises } = useEntreprises()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<StatusGroupKey>('all')
  const [view, setView] = useState<ContactsView>('liste')

  const activeGroup = STATUS_GROUPS.find((g) => g.key === group)!
  const groupCounts = useMemo(() => countByGroup(prospects), [prospects])

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return prospects
    return prospects.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        (p.entreprise?.entreprise ?? '').toLowerCase().includes(q) ||
        (p.entreprise?.ville ?? '').toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q),
    )
  }, [prospects, search])

  const filtered = useMemo(() => {
    if (!activeGroup.statuses) return searchFiltered
    return searchFiltered.filter((p) => activeGroup.statuses!.includes(p.status))
  }, [searchFiltered, activeGroup])

  const selected = selectedId ? (getProspect(selectedId) ?? null) : null

  const handleCreate = async (input: CreateContactInput) => {
    const id = await createProspect(input)
    if (id) {
      // A free-text company may have just been created server-side.
      if (!input.entrepriseId) void refreshEntreprises()
      setSelectedId(id)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tes contacts</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Toutes les personnes que tu suis.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Ajouter un contact
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Chercher un nom, une entreprise, une ville…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {/* View switcher */}
          <div className="bg-muted/40 flex rounded-lg border p-0.5">
            {VIEWS.map((v) => (
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
                <span className="max-sm:hidden">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Visual pipeline cards — counts double as filters (liste view) */}
        <div
          className={cn(
            'grid grid-cols-2 gap-2 sm:grid-cols-5',
            view !== 'liste' && 'hidden',
          )}
        >
          {STATUS_GROUPS.map((g) => {
            const count =
              g.key === 'all'
                ? prospects.length
                : groupCounts[g.key as keyof typeof groupCounts]
            const color = GROUP_COLORS[g.key]
            const active = group === g.key
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroup(g.key)}
                className={cn(
                  'bg-card flex flex-col gap-0.5 rounded-xl border p-3 text-left shadow-xs transition-all',
                  active
                    ? 'border-foreground ring-foreground/20 ring-2'
                    : 'hover:bg-muted/40',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {color ? (
                    <span className={cn('size-2 rounded-full', color.dot)} />
                  ) : null}
                  <span className="text-muted-foreground text-xs font-medium">
                    {g.label}
                  </span>
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex min-w-0 flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ContactCardSkeleton key={i} />
          ))}
        </div>
      ) : (view === 'liste' ? filtered : searchFiltered).length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          {prospects.length === 0
            ? 'Personne pour le moment — ajoute un contact ou va chercher des prospects !'
            : 'Aucun contact ne correspond.'}
        </div>
      ) : view === 'pipeline' ? (
        <PipelineView
          prospects={searchFiltered}
          onOpen={(id) => setSelectedId(id)}
        />
      ) : view === 'entreprises' ? (
        <EntreprisesView
          prospects={searchFiltered}
          onOpen={(id) => setSelectedId(id)}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {filtered.map((p) => (
            <ContactCard key={p.id} p={p} onClick={() => setSelectedId(p.id)} />
          ))}
        </div>
      )}

      <CreateContactDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
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
