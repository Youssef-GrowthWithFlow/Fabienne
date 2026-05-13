import {
  Link2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { Textarea } from '@/components/ui/textarea'

type ProspectStatus =
  | 'À contacter'
  | 'Contacté'
  | 'En discussion'
  | 'Sans réponse'
  | 'Refus'

const STATUSES: ProspectStatus[] = [
  'À contacter',
  'Contacté',
  'En discussion',
  'Sans réponse',
  'Refus',
]

type Segment = 'Pharmacie' | 'Startup' | 'Collectivité'

const SEGMENTS: Segment[] = ['Pharmacie', 'Startup', 'Collectivité']

type Comment = {
  id: string
  date: string // ISO
  texte: string
}

type Prospect = {
  id: string
  nom: string
  entreprise: string
  role: string
  segments: Segment[]
  telephone: string
  email: string
  linkedin: string | null
  comments: Comment[]
  status: ProspectStatus
}

const initialProspects: Prospect[] = [
  {
    id: '1',
    nom: 'Emilie Genieys',
    entreprise: 'Pharmacie Genieys',
    role: 'Pharmacien titulaire',
    segments: ['Pharmacie'],
    telephone: '05 61 82 37 64',
    email: 'pharmacie.gratentour@gmail.com',
    linkedin: null,
    comments: [
      {
        id: 'c1',
        date: '2026-05-13',
        texte: 'Reprise très récente (avril 2026)',
      },
    ],
    status: 'À contacter',
  },
]

const statusVariant: Record<
  ProspectStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  'À contacter': 'outline',
  Contacté: 'secondary',
  'En discussion': 'default',
  'Sans réponse': 'outline',
  Refus: 'destructive',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function sortCommentsDesc(list: Comment[]): Comment[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
}

function latestComment(list: Comment[]): Comment | undefined {
  let max: Comment | undefined
  for (const c of list) {
    if (!max || c.date > max.date) max = c
  }
  return max
}

function newId(prefix = ''): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

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

function PhoneLink({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <a
      href={`tel:${value.replace(/\s/g, '')}`}
      onClick={(e) => e.stopPropagation()}
      className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"
    >
      <Phone className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{value}</span>
    </a>
  )
}

function EmailLink({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <a
      href={`mailto:${value}`}
      onClick={(e) => e.stopPropagation()}
      className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"
    >
      <Mail className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{value}</span>
    </a>
  )
}

function LinkedinLink({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm hover:underline"
    >
      <Link2 className="size-3.5 shrink-0" />
      Profil
    </a>
  )
}

function CommentEntry({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: Comment
  onUpdate: (id: string, texte: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.texte)

  function startEdit() {
    setDraft(entry.texte)
    setEditing(true)
  }

  function commit() {
    const t = draft.trim()
    if (!t || t === entry.texte) {
      setEditing(false)
      return
    }
    onUpdate(entry.id, t)
    setEditing(false)
  }

  return (
    <div className="group bg-muted/40 hover:bg-muted/70 flex items-start gap-3 rounded-md border px-3 py-2 transition-colors">
      <span className="text-muted-foreground pt-0.5 text-xs font-medium tabular-nums whitespace-nowrap">
        {formatDate(entry.date)}
      </span>
      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false)
              return
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              commit()
            }
          }}
          rows={2}
          className="flex-1 text-sm"
        />
      ) : (
        <p
          className="flex-1 cursor-text text-sm break-words whitespace-pre-wrap"
          onClick={startEdit}
          title="Cliquer pour modifier"
        >
          {entry.texte}
        </p>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {!editing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={startEdit}
              aria-label="Modifier"
              title="Modifier"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(entry.id)}
              aria-label="Supprimer"
              title="Supprimer"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AddCommentForm({ onAdd }: { onAdd: (texte: string) => void }) {
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const t = draft.trim()
    if (!t) return
    onAdd(t)
    setDraft('')
    ref.current?.focus()
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        rows={3}
        placeholder="Ajouter un commentaire… (Cmd/Ctrl+Enter pour envoyer)"
        className="text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!draft.trim()}>
          Ajouter
        </Button>
      </div>
    </div>
  )
}

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
            {p.role} · {p.entreprise}
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

      <dl className="grid grid-cols-1 gap-2 text-sm">
        <div className="min-w-0">
          <dt className="sr-only">Téléphone</dt>
          <dd>
            <PhoneLink value={p.telephone} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="sr-only">Email</dt>
          <dd className="min-w-0">
            <EmailLink value={p.email} />
          </dd>
        </div>
        <div>
          <dt className="sr-only">LinkedIn</dt>
          <dd>
            <LinkedinLink value={p.linkedin} />
          </dd>
        </div>
      </dl>

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
      <col className="w-[160px]" />
      <col className="w-[180px]" />
      <col className="w-[160px]" />
      <col className="w-[180px]" />
      <col className="w-[140px]" />
      <col className="w-[220px]" />
      <col className="w-[110px]" />
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
      <TableHead>Téléphone</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>LinkedIn</TableHead>
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

function ProspectSheet({
  prospect,
  onClose,
  onChange,
}: {
  prospect: Prospect
  onClose: () => void
  onChange: (next: Prospect) => void
}) {
  const update = <K extends keyof Prospect>(key: K, value: Prospect[K]) => {
    onChange({ ...prospect, [key]: value })
  }

  const addComment = (texte: string) => {
    const next: Comment = {
      id: newId('c'),
      date: new Date().toISOString(),
      texte,
    }
    update('comments', [next, ...prospect.comments])
  }

  const updateComment = (id: string, texte: string) => {
    update(
      'comments',
      prospect.comments.map((c) => (c.id === id ? { ...c, texte } : c)),
    )
  }

  const deleteComment = (id: string) => {
    update(
      'comments',
      prospect.comments.filter((c) => c.id !== id),
    )
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>Modifier le prospect</SheetTitle>
          <SheetDescription>
            Les changements sont enregistrés automatiquement.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="nom">Nom</Label>
            <Input
              id="nom"
              value={prospect.nom}
              onChange={(e) => update('nom', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="entreprise">Entreprise</Label>
            <Input
              id="entreprise"
              value={prospect.entreprise}
              onChange={(e) => update('entreprise', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Rôle</Label>
            <Input
              id="role"
              value={prospect.role}
              onChange={(e) => update('role', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Segments</Label>
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => {
                const active = prospect.segments.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      update(
                        'segments',
                        active
                          ? prospect.segments.filter((x) => x !== s)
                          : [...prospect.segments, s],
                      )
                    }
                    className={
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                      (active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted text-muted-foreground')
                    }
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={prospect.status}
              onValueChange={(v) => update('status', v as ProspectStatus)}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              type="tel"
              placeholder="06 12 34 56 78"
              value={prospect.telephone}
              onChange={(e) => update('telephone', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@exemple.com"
              value={prospect.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              type="url"
              placeholder="https://linkedin.com/in/…"
              value={prospect.linkedin ?? ''}
              onChange={(e) =>
                update('linkedin', e.target.value ? e.target.value : null)
              }
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-3 text-sm font-medium">
              Commentaires{' '}
              <span className="text-muted-foreground font-normal">
                ({prospect.comments.length})
              </span>
            </h3>
            <AddCommentForm onAdd={addComment} />
            {prospect.comments.length > 0 ? (
              <div className="mt-3 space-y-2">
                {sortCommentsDesc(prospect.comments).map((entry) => (
                  <CommentEntry
                    key={entry.id}
                    entry={entry}
                    onUpdate={updateComment}
                    onDelete={deleteComment}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <SheetFooter className="border-t">
          <SheetClose render={<Button variant="outline" type="button" />}>
            Fermer
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

type SegmentFilter = 'all' | Segment

function isSegmentFilter(v: string): v is SegmentFilter {
  return v === 'all' || (SEGMENTS as readonly string[]).includes(v)
}

export function Prospects() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setProspects(initialProspects)
      setLoading(false)
    }, 700)
    return () => clearTimeout(t)
  }, [])

  const segmentCounts = useMemo(() => {
    const counts: Record<Segment, number> = {
      Pharmacie: 0,
      Startup: 0,
      Collectivité: 0,
    }
    for (const p of prospects) {
      for (const s of p.segments) counts[s]++
    }
    return counts
  }, [prospects])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return prospects.filter((p) => {
      if (segmentFilter !== 'all' && !p.segments.includes(segmentFilter)) {
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
  }, [prospects, search, segmentFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [search, segmentFilter])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selected = prospects.find((p) => p.id === selectedId) ?? null

  const openProspect = (id: string) => setSelectedId(id)
  const closeSheet = () => setSelectedId(null)

  const handleChange = (next: Prospect) => {
    setProspects((list) => list.map((p) => (p.id === next.id ? next : p)))
  }

  const handleCreate = () => {
    const id = newId('p')
    const next: Prospect = {
      id,
      nom: '',
      entreprise: '',
      role: '',
      segments: [],
      telephone: '',
      email: '',
      linkedin: null,
      comments: [],
      status: 'À contacter',
    }
    setProspects((list) => [next, ...list])
    setSelectedId(id)
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

      <div className="sm:hidden">
        <Select
          value={segmentFilter}
          onValueChange={(v) =>
            typeof v === 'string' && isSegmentFilter(v) && setSegmentFilter(v)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value: unknown) =>
                value === 'all' ? 'Tous' : String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {SEGMENTS.map((s) => {
              return (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={segmentFilter}
        onValueChange={(v) => isSegmentFilter(v) && setSegmentFilter(v)}
        className="hidden sm:flex"
      >
        <TabsList>
          <TabsTrigger value="all">
            Tous
            <Badge variant="secondary" className="ml-1.5">
              {loading ? (
                <Skeleton className="h-3 w-4" />
              ) : (
                prospects.length
              )}
            </Badge>
          </TabsTrigger>
          {SEGMENTS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s}
              <Badge variant="secondary" className="ml-1.5">
                {loading ? (
                  <Skeleton className="h-3 w-4" />
                ) : (
                  segmentCounts[s]
                )}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3">
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
        {search ? (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            <X className="mr-1 size-4" /> Réinitialiser
          </Button>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs">
          {loading ? (
            <Skeleton className="inline-block h-3 w-20" />
          ) : (
            `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`
          )}
        </span>
      </div>

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
                    {Array.from({ length: 9 }).map((__, j) => (
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
                  <TableCell>
                    <PhoneLink value={p.telephone} />
                  </TableCell>
                  <TableCell>
                    <EmailLink value={p.email} />
                  </TableCell>
                  <TableCell>
                    <LinkedinLink value={p.linkedin} />
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
          onChange={handleChange}
        />
      ) : null}
    </>
  )
}
