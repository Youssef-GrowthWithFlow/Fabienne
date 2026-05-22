import { Building2, Plus, Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EntrepriseMeta } from '@/components/entreprise-meta'
import { EntrepriseSheet } from '@/components/entreprise-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import { useSegments } from '@/hooks/use-segments'
import type { EntrepriseRecord } from '@/lib/entreprises'
import { SEGMENT_ALL, SEGMENT_NONE } from '@/lib/segment-constants'

const EMPTY_PAYLOAD: Omit<EntrepriseRecord, 'id' | 'dateAjout'> = {
  segmentId: null,
  entreprise: '',
  siteWeb: '',
  secteur: '',
  adresse: '',
  codePostal: '',
  ville: '',
  taille: '',
  ca: '',
  linkedin: '',
  score: '',
  origine: 'Manuel',
  signaux: [],
  note: '',
  ficheClient: '',
  siren: null,
  siret: null,
  nafCode: null,
  nafLabel: null,
  effectif: null,
  dateCreation: null,
  dirigeants: [],
  telephone: '',
  googlePlaceId: '',
  googleMapsUrl: '',
  googleRating: null,
  googleRatingCount: null,
  latitude: null,
  longitude: null,
  fieldSources: {},
}

export function Entreprises() {
  const { entreprises, loading, addEntreprise, getById } = useEntreprises()
  const { prospects } = useProspects()
  const { segments, briefs } = useSegments()

  const [segmentFilter, setSegmentFilter] = useState<string>(SEGMENT_ALL)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const prospectsByEntreprise = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of prospects) {
      if (!p.entrepriseId) continue
      map.set(p.entrepriseId, (map.get(p.entrepriseId) ?? 0) + 1)
    }
    return map
  }, [prospects])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entreprises
      .filter((e) => {
        if (segmentFilter === SEGMENT_ALL) return true
        if (segmentFilter === SEGMENT_NONE) return !e.segmentId
        return e.segmentId === segmentFilter
      })
      .filter((e) => {
        if (!needle) return true
        return (
          e.entreprise.toLowerCase().includes(needle) ||
          e.ville.toLowerCase().includes(needle) ||
          (e.siret ?? '').toLowerCase().includes(needle)
        )
      })
  }, [entreprises, segmentFilter, search])

  const handleCreate = async () => {
    const created = await addEntreprise({ ...EMPTY_PAYLOAD })
    if (created) setOpenId(created.id)
  }

  const selected = openId ? getById(openId) ?? null : null

  return (
    <>
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Building2 className="size-5 text-primary" />
          Tes entreprises
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {entreprises.length === 0
            ? 'Aucune entreprise pour l’instant — ajoutes-en une pour démarrer.'
            : `${entreprises.length} entreprise${entreprises.length > 1 ? 's' : ''} dans ton carnet.`}
        </p>
      </div>

      <Button onClick={handleCreate} className="w-full sm:w-fit">
        <Plus className="size-4" />
        Nouvelle entreprise
      </Button>

      {/* Filtres mobile : selects --------------------------------------- */}
      <div className="flex gap-2 sm:hidden">
        <Select
          value={segmentFilter}
          onValueChange={(v) => typeof v === 'string' && setSegmentFilter(v)}
        >
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue>
              {(value: unknown) =>
                value === SEGMENT_ALL
                  ? 'Tous les segments'
                  : value === SEGMENT_NONE
                    ? 'Sans segment'
                    : briefs[String(value)]?.nom ?? String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEGMENT_ALL}>Tous les segments</SelectItem>
            <SelectItem value={SEGMENT_NONE}>Sans segment</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s} value={s}>
                {briefs[s]?.nom ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtres desktop : tabs ----------------------------------------- */}
      <Tabs
        value={segmentFilter}
        onValueChange={(v) => typeof v === 'string' && setSegmentFilter(v)}
        className="hidden sm:flex"
      >
        <TabsList>
          <TabsTrigger value={SEGMENT_ALL}>Tous</TabsTrigger>
          <TabsTrigger value={SEGMENT_NONE}>Sans segment</TabsTrigger>
          {segments.map((s) => (
            <TabsTrigger key={s} value={s}>
              {briefs[s]?.nom ?? s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Rechercher par nom, ville, SIRET…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {search || segmentFilter !== SEGMENT_ALL ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setSegmentFilter(SEGMENT_ALL)
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
          `${filtered.length} entreprise${filtered.length > 1 ? 's' : ''}`
        )}
      </p>

      {!loading && filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Aucune entreprise. Lance un sourcing ou crée-en une manuellement.
        </div>
      ) : null}

      {/* Cards mobile -------------------------------------------------- */}
      <div className="flex min-w-0 flex-col gap-3 lg:hidden">
        {loading
          ? [0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          : filtered.map((e) => (
              <EntrepriseCard
                key={e.id}
                entreprise={e}
                prospectCount={prospectsByEntreprise.get(e.id) ?? 0}
                segmentName={
                  e.segmentId ? briefs[e.segmentId]?.nom ?? e.segmentId : null
                }
                onClick={() => setOpenId(e.id)}
              />
            ))}
      </div>

      {/* Table desktop ------------------------------------------------- */}
      <div
        className={
          !loading && filtered.length === 0
            ? 'hidden'
            : 'hidden rounded-xl border lg:block'
        }
      >
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col />
            <col className="w-[100px]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Secteur</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Signaux</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? [0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    {[0, 1, 2, 3, 4, 5].map((j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.map((e) => {
                  const count = prospectsByEntreprise.get(e.id) ?? 0
                  const segmentName = e.segmentId
                    ? briefs[e.segmentId]?.nom ?? e.segmentId
                    : null
                  const signaux = e.signaux ?? []
                  return (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => setOpenId(e.id)}
                    >
                      <TableCell className="truncate font-medium">
                        {e.entreprise || (
                          <span className="italic text-muted-foreground">
                            Sans nom
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate">
                        {e.ville || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate">
                        {e.secteur || e.nafLabel || '—'}
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        {segmentName ? (
                          <Badge variant="secondary">{segmentName}</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <div className="flex flex-wrap gap-1">
                          {signaux.slice(0, 3).map((s, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="border-border bg-transparent font-normal text-[11px] text-muted-foreground"
                            >
                              {s}
                            </Badge>
                          ))}
                          {signaux.length > 3 && (
                            <span className="text-[11px] text-muted-foreground/80">
                              +{signaux.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {count}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <EntrepriseSheet
          entreprise={selected}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  )
}

function EntrepriseCard({
  entreprise: e,
  prospectCount,
  segmentName,
  onClick,
}: {
  entreprise: EntrepriseRecord
  prospectCount: number
  segmentName: string | null
  onClick: () => void
}) {
  const signaux = e.signaux ?? []
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:bg-muted/40 focus-visible:ring-ring flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-2"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">
            {e.entreprise || (
              <span className="italic text-muted-foreground">Sans nom</span>
            )}
          </h3>
          <p className="text-muted-foreground truncate text-sm">
            {[e.ville, e.codePostal].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {segmentName ? (
          <Badge variant="secondary" className="shrink-0">
            {segmentName}
          </Badge>
        ) : null}
      </header>

      <EntrepriseMeta entreprise={e} />

      {signaux.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {signaux.slice(0, 4).map((s, i) => (
            <Badge
              key={i}
              variant="outline"
              className="border-primary/20 bg-primary/[0.04] font-normal"
            >
              {s}
            </Badge>
          ))}
          {signaux.length > 4 && (
            <span className="text-[11px] text-muted-foreground/80">
              +{signaux.length - 4}
            </span>
          )}
        </div>
      )}

      <footer className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" />
          {prospectCount} prospect{prospectCount > 1 ? 's' : ''}
        </span>
        {e.dateCreation && <span>Créée le {e.dateCreation}</span>}
      </footer>
    </button>
  )
}
