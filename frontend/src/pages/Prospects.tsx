import { Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ProspectSheet } from '@/components/prospect-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  STATUSES,
  formatDate,
  isStatusFilter,
  latestComment,
  statusVariant,
  type Prospect,
  type SegmentFilter,
  type StatusFilter,
} from '@/lib/prospects'
import { useProspects } from '@/hooks/use-prospects'
import { useSegments } from '@/hooks/use-segments'

function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) pages.push('…')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

const PAGE_SIZE = 10

function ProspectCard({
  p,
  onClick,
}: {
  p: Prospect
  onClick: () => void
}) {
  const latest = latestComment(p.comments)
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:bg-muted/40 focus-visible:ring-ring flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-2"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{p.nom}</h3>
          <p className="text-muted-foreground truncate text-sm">
            {p.role}
            {p.role && p.entreprise ? ' · ' : ''}
            {p.entreprise}
          </p>
        </div>
        <Badge variant={statusVariant[p.status]} className="shrink-0">
          {p.status}
        </Badge>
      </header>

      {p.segments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {p.segments.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}

      {latest ? (
        <div className="text-muted-foreground border-t pt-3 text-sm">
          <p className="line-clamp-2 break-words whitespace-pre-wrap">
            <span className="tabular-nums">{formatDate(latest.date)}</span>
            {' · '}
            {latest.texte}
          </p>
          {p.comments.length > 1 ? (
            <p className="mt-1 text-xs">
              + {p.comments.length - 1} autre
              {p.comments.length - 1 > 1 ? 's' : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}

function ProspectTableColGroup() {
  return (
    <colgroup>
      <col className="w-[180px]" />
      <col className="w-[200px]" />
      <col className="w-[180px]" />
      <col className="w-[200px]" />
      <col />
      <col className="w-[130px]" />
    </colgroup>
  )
}

function ProspectTableHeaderRow() {
  return (
    <TableRow>
      <TableHead>Nom</TableHead>
      <TableHead>Entreprise</TableHead>
      <TableHead>Rôle</TableHead>
      <TableHead>Segments</TableHead>
      <TableHead>Dernier commentaire</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  )
}

function ProspectCardSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      <div className="border-t pt-3">
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

export function Prospects() {
  const { prospects, loading, getProspect, updateProspect, createProspect } =
    useProspects()
  const { segments, briefs: segmentBriefs } = useSegments()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return prospects.filter((p) => {
      if (segmentFilter !== 'all' && !p.segments.includes(segmentFilter)) {
        return false
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false
      }
      if (!q) return true
      return (
        p.nom.toLowerCase().includes(q) ||
        p.entreprise.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.telephone.toLowerCase().includes(q) ||
        p.comments.some((c) => c.texte.toLowerCase().includes(q))
      )
    })
  }, [prospects, search, segmentFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [search, segmentFilter, statusFilter])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selected = selectedId ? (getProspect(selectedId) ?? null) : null

  const openProspect = (id: string) => setSelectedId(id)
  const closeSheet = () => setSelectedId(null)

  const handleCreate = () => {
    setSelectedId(createProspect())
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Prospects</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Liste des prospects qualifiés et suivi des échanges.
        </p>
      </div>

      <Button onClick={handleCreate} className="w-full sm:w-fit">
        <Plus className="size-4" />
        Nouveau prospect
      </Button>

      <div className="flex gap-2 sm:hidden">
        <Select
          value={segmentFilter}
          onValueChange={(v) =>
            typeof v === 'string' && setSegmentFilter(v)
          }
        >
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue>
              {(value: unknown) =>
                value === 'all'
                  ? 'Tous les segments'
                  : segmentBriefs[String(value)]?.nom ?? String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les segments</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s} value={s}>
                {segmentBriefs[s]?.nom ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            typeof v === 'string' && isStatusFilter(v) && setStatusFilter(v)
          }
        >
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue>
              {(value: unknown) =>
                value === 'all' ? 'Tous les statuts' : String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={segmentFilter}
        onValueChange={setSegmentFilter}
        className="hidden sm:flex"
      >
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          {segments.map((s) => (
            <TabsTrigger key={s} value={s}>
              {segmentBriefs[s]?.nom ?? s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Rechercher un prospect…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            typeof v === 'string' && isStatusFilter(v) && setStatusFilter(v)
          }
        >
          <SelectTrigger className="hidden w-44 sm:flex">
            <SelectValue>
              {(value: unknown) =>
                value === 'all' ? 'Tous les statuts' : String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {search || statusFilter !== 'all' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          >
            <X className="mr-1 size-4" /> Réinitialiser
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs tabular-nums">
        {loading ? (
          <Skeleton className="inline-block h-3 w-20" />
        ) : (
          `${filtered.length} prospect${filtered.length > 1 ? 's' : ''}`
        )}
      </p>

      {!loading && filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          Aucun prospect trouvé.
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3 lg:hidden">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <ProspectCardSkeleton key={i} />
            ))
          : paged.map((p) => (
              <ProspectCard
                key={p.id}
                p={p}
                onClick={() => openProspect(p.id)}
              />
            ))}
      </div>

      <div
        className={
          !loading && filtered.length === 0
            ? 'hidden'
            : 'hidden rounded-xl border lg:block'
        }
      >
        <Table className="table-fixed">
          <ProspectTableColGroup />
          <TableHeader>
            <ProspectTableHeaderRow />
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : paged.map((p) => {
              const latest = latestComment(p.comments)
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => openProspect(p.id)}
                >
                  <TableCell className="truncate font-medium">
                    {p.nom}
                  </TableCell>
                  <TableCell className="truncate">{p.entreprise}</TableCell>
                  <TableCell className="text-muted-foreground truncate">
                    {p.role}
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <div className="flex flex-wrap gap-1">
                      {p.segments.map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">
                    {latest ? (
                      <span className="line-clamp-2">
                        <span className="tabular-nums">
                          {formatDate(latest.date)}
                        </span>
                        {' · '}
                        {latest.texte}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!loading && filtered.length > PAGE_SIZE ? (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-muted-foreground text-xs">
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} sur{' '}
            {filtered.length}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text="Précédent"
                  aria-disabled={page === 1}
                  className={
                    page === 1 ? 'pointer-events-none opacity-50' : ''
                  }
                  onClick={() => setPage(Math.max(1, page - 1))}
                />
              </PaginationItem>
              {buildPageList(page, totalPages).map((p, i) =>
                p === '…' ? (
                  <PaginationItem key={`e-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === page}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  text="Suivant"
                  aria-disabled={page === totalPages}
                  className={
                    page === totalPages
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }
                  onClick={() =>
                    setPage(Math.min(totalPages, page + 1))
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}

      {selected ? (
        <ProspectSheet
          prospect={selected}
          onClose={closeSheet}
          onChange={updateProspect}
        />
      ) : null}
    </>
  )
}
