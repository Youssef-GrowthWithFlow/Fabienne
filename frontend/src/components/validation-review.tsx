import {
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Map as MapIcon,
  MapPin,
  PartyPopper,
  Phone,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { SignalBadge } from '@/components/signal-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import {
  useSourcerHistory,
  type SourcerCandidate,
} from '@/hooks/use-sourcer-history'
import { fireConfetti } from '@/lib/confetti'
import { getEntreprise } from '@/lib/entreprises-api'
import { getProspect } from '@/lib/prospects-api'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  /** Candidate to show first. A treated (non-pending) id opens a read-only
   *  view of that single candidate instead of the queue. */
  initialId?: string | null
}

/**
 * The validation experience: one candidate at a time, everything visible,
 * two big buttons, auto-advance to the next one after each decision, and a
 * small recap when the queue is empty. Openable from any page (Recherche,
 * Tâches) — the sourcing state lives in SourcerProvider.
 */
export function ValidationReview({ open, onClose, initialId }: Props) {
  const { candidates, validate, refuse, pickContact } = useSourcerHistory()
  const { ingestMany } = useEntreprises()
  const { addProspect, replaceProspectLocal } = useProspects()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'queue' | 'single'>('queue')
  const [ids, setIds] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Latest values for the delayed auto-advance (setTimeout closures).
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates
  const idsRef = useRef(ids)
  idsRef.current = ids

  // (Re)build the queue each time the review opens.
  useEffect(() => {
    if (!open) return
    const pending = candidatesRef.current
      .filter((c) => c.status === 'pending')
      .map((c) => c.id)
    if (initialId && !pending.includes(initialId)) {
      setMode('single')
      setIds([initialId])
      setIndex(0)
    } else {
      setMode('queue')
      setIds(pending)
      setIndex(Math.max(0, initialId ? pending.indexOf(initialId) : 0))
    }
    setFinished(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the queue in sync with live streaming: temp ids get promoted to DB
  // ids at end-of-run, dropped candidates vanish, fresh pending ones join.
  useEffect(() => {
    if (!open) return
    setIds((prev) => {
      const mapped = prev
        .map((id) => {
          if (candidates.some((c) => c.id === id)) return id
          return candidates.find((c) => c.tempId === id)?.id ?? id
        })
        .filter((id) => candidates.some((c) => c.id === id))
      const next =
        mode === 'queue'
          ? [
              ...mapped,
              ...candidates
                .filter(
                  (c) => c.status === 'pending' && !mapped.includes(c.id),
                )
                .map((c) => c.id),
            ]
          : mapped
      const same =
        next.length === prev.length && next.every((id, i) => id === prev[i])
      return same ? prev : next
    })
  }, [candidates, open, mode])

  const safeIndex = Math.min(index, Math.max(0, ids.length - 1))
  const current = candidates.find((c) => c.id === ids[safeIndex]) ?? null
  const decidedCount = ids.filter(
    (id) => candidates.find((c) => c.id === id)?.status !== 'pending',
  ).length
  const validatedCount = ids.filter(
    (id) => candidates.find((c) => c.id === id)?.status === 'validated',
  ).length

  const advance = useCallback(() => {
    const list = idsRef.current
    const cands = candidatesRef.current
    setIndex((i) => {
      for (let step = 1; step <= list.length; step++) {
        const j = (i + step) % list.length
        const c = cands.find((x) => x.id === list[j])
        if (c?.status === 'pending') return j
      }
      setFinished(true)
      return i
    })
  }, [])

  const scheduleRefresh = useCallback(
    (entrepriseId?: string | null, prospectId?: string | null) => {
      // Fiche + coordonnées land in background a few seconds after validate
      // returns — refresh a few times so the data shows up on its own.
      const refreshOnce = async () => {
        try {
          if (entrepriseId) ingestMany([await getEntreprise(entrepriseId)])
          if (prospectId) replaceProspectLocal(await getProspect(prospectId))
        } catch {
          /* soft-fail */
        }
      }
      for (const delay of [8_000, 20_000, 45_000]) {
        window.setTimeout(refreshOnce, delay)
      }
    },
    [ingestMany, replaceProspectLocal],
  )

  const decide = useCallback(
    async (candidate: SourcerCandidate, action: 'validate' | 'refuse') => {
      setBusyId(candidate.id)
      try {
        if (action === 'validate') {
          const res = await validate(candidate.id)
          if (res.entreprise) ingestMany([res.entreprise])
          if (res.prospect) addProspect(res.prospect)
          const nom =
            res.entreprise?.entreprise || res.prospect?.nom || 'Prospect'
          fireConfetti('small')
          toast.success(`${nom} rejoint tes contacts ✨`, {
            description:
              'Tâche créée : le contacter aujourd’hui. Je prépare sa fiche et je cherche ses coordonnées…',
          })
          scheduleRefresh(res.entreprise?.id, res.prospect?.id)
        } else {
          await refuse(candidate.id)
        }
        window.setTimeout(advance, 450)
      } catch {
        toast.error('Ça n’a pas marché — réessaie.')
      } finally {
        setBusyId(null)
      }
    },
    [validate, refuse, ingestMany, addProspect, scheduleRefresh, advance],
  )

  // ← / → to move through the queue.
  useEffect(() => {
    if (!open || mode !== 'queue') return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(i + 1, idsRef.current.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, mode])

  // Celebrate a finished queue that added at least one contact.
  useEffect(() => {
    if (finished && validatedCount > 0) fireConfetti('big')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  const showRecap = finished || (open && mode === 'queue' && ids.length === 0)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex !w-full flex-col gap-0 overflow-hidden p-0 sm:!max-w-2xl">
        {showRecap ? (
          <Recap
            validated={validatedCount}
            refused={decidedCount - validatedCount}
            onClose={onClose}
            onGo={(to) => {
              onClose()
              navigate(to)
            }}
          />
        ) : current ? (
          <CandidatePane
            candidate={current}
            position={safeIndex + 1}
            total={ids.length}
            decided={decidedCount}
            queueMode={mode === 'queue'}
            busy={busyId === current.id}
            onPrev={() => setIndex((i) => Math.max(i - 1, 0))}
            onNext={() => setIndex((i) => Math.min(i + 1, ids.length - 1))}
            onPickContact={(i) => pickContact(current.id, i)}
            onValidate={() => decide(current, 'validate')}
            onRefuse={() => decide(current, 'refuse')}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Recap({
  validated,
  refused,
  onClose,
  onGo,
}: {
  validated: number
  refused: number
  onClose: () => void
  onGo: (to: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300 flex size-14 items-center justify-center rounded-full">
        <PartyPopper className="size-7" />
      </div>
      <div>
        <p className="text-xl font-semibold">C'est tout bon !</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {validated > 0
            ? `${validated} prospect${validated > 1 ? 's' : ''} ajouté${validated > 1 ? 's' : ''} à tes contacts`
            : 'Aucun prospect ajouté'}
          {refused > 0
            ? ` · ${refused} écarté${refused > 1 ? 's' : ''}`
            : ''}
          .
        </p>
        {validated > 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Je complète leurs fiches et leurs coordonnées — et ta prochaine
            étape est déjà planifiée : les contacter aujourd'hui.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {validated > 0 ? (
          <Button
            onClick={() => onGo('/taches')}
            className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
          >
            Voir mes tâches
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => onGo('/contacts')}>
          Voir mes contacts
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  )
}

function CandidatePane({
  candidate,
  position,
  total,
  decided,
  queueMode,
  busy,
  onPrev,
  onNext,
  onPickContact,
  onValidate,
  onRefuse,
}: {
  candidate: SourcerCandidate
  position: number
  total: number
  decided: number
  queueMode: boolean
  busy: boolean
  onPrev: () => void
  onNext: () => void
  onPickContact: (index: number) => void
  onValidate: () => void
  onRefuse: () => void
}) {
  const isPending = candidate.status === 'pending'
  // Streaming candidates (temp id) would 404 on validate/refuse — lock the
  // actions until enrichment finishes and the row is persisted.
  const locked = candidate.enriching || candidate.persisted === false

  const address = [
    candidate.adresse,
    [candidate.codePostal, candidate.ville].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' — ')
  // INSEE renvoie « NN » quand l'effectif n'est pas renseigné — pas parlant.
  const rawTaille = candidate.effectif || candidate.taille || ''
  const taille = rawTaille === 'NN' ? '' : rawTaille
  const secteur = candidate.secteur || candidate.nafLabel || ''
  const rating = candidate.googleRating
  const sources = candidate.sources ?? []

  return (
    <>
      {/* En-tête : progression + navigation ------------------------------- */}
      <div className="shrink-0 border-b px-4 py-3 sm:px-6">
        {queueMode ? (
          <div className="mb-2 flex items-center gap-3 pr-10">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              À valider
            </span>
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-300"
                style={{
                  width: `${total > 0 ? (decided / total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {position} / {total}
            </span>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onPrev}
                disabled={position <= 1}
                aria-label="Prospect précédent"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNext}
                disabled={position >= total}
                aria-label="Prospect suivant"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
            <SheetTitle className="!text-xl font-semibold leading-snug tracking-tight">
              {candidate.entreprise || 'Sans nom'}
            </SheetTitle>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {[candidate.ville, secteur].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          {candidate.status === 'validated' ? (
            <Badge className="mt-1 shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-600">
              <Check className="size-3" />
              Ajouté
            </Badge>
          ) : candidate.status === 'refused' ? (
            <Badge variant="outline" className="text-muted-foreground mt-1 shrink-0 gap-1">
              <X className="size-3" />
              Écarté
            </Badge>
          ) : candidate.enriching ? (
            <Badge
              variant="outline"
              className="mt-1 shrink-0 gap-1 border-violet-300 font-normal text-violet-600 dark:border-violet-800 dark:text-violet-300"
            >
              <Loader2 className="size-3 animate-spin" />
              Je complète…
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Corps ------------------------------------------------------------ */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        {/* L'avis de Fabienne d'abord — c'est ce qui aide à décider. */}
        {(candidate.raison || (candidate.signaux?.length ?? 0) > 0) && (
          <div className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Sparkles className="size-3.5" />
              Pourquoi je te la propose
            </div>
            {candidate.raison ? (
              <p className="text-sm leading-relaxed">{candidate.raison}</p>
            ) : null}
            {candidate.signaux && candidate.signaux.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {candidate.signaux.map((s, i) => (
                  <SignalBadge key={i}>{s}</SignalBadge>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* L'essentiel en un coup d'œil */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-4">
          <Fact label="Avis Google">
            {rating != null ? (
              <span className="flex items-center gap-1 font-semibold tabular-nums">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
                {candidate.googleRatingCount != null ? (
                  <span className="text-muted-foreground text-xs font-normal">
                    ({candidate.googleRatingCount})
                  </span>
                ) : null}
              </span>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label="Ville" icon={MapPin}>
            {candidate.ville || '—'}
          </Fact>
          <Fact label="Taille" icon={Users}>
            {taille || '—'}
          </Fact>
          <Fact label="Secteur" icon={Briefcase} title={secteur}>
            {secteur || '—'}
          </Fact>
        </div>

        {/* Qui suivre */}
        {candidate.contacts.length > 0 && (
          <section>
            <SectionLabel>
              {candidate.contacts.length > 1
                ? 'Qui veux-tu suivre ?'
                : 'Ton futur contact'}
            </SectionLabel>
            <RadioGroup
              value={String(candidate.mainContactIndex)}
              onValueChange={(v: string) => onPickContact(Number(v))}
              className="flex flex-col gap-1.5"
            >
              {candidate.contacts.map((c, i) => (
                <label
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                    candidate.contacts.length > 1 && 'cursor-pointer',
                    candidate.mainContactIndex === i
                      ? 'border-violet-300 bg-violet-50/40 dark:border-violet-800 dark:bg-violet-950/20'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  {candidate.contacts.length > 1 ? (
                    <RadioGroupItem value={String(i)} className="mt-0.5" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {c.nom || 'Sans nom'}
                    </span>
                    {c.role ? (
                      <div className="text-muted-foreground text-xs">
                        {c.role}
                      </div>
                    ) : null}
                  </div>
                </label>
              ))}
            </RadioGroup>
            {isPending ? (
              <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
                <Sparkles className="size-3 text-violet-500" />
                Après l'ajout, je cherche son email, son téléphone et son
                LinkedIn automatiquement.
              </p>
            ) : null}
          </section>
        )}

        {/* Coordonnées de l'entreprise */}
        {(address ||
          candidate.telephone ||
          candidate.siteWeb ||
          candidate.googleMapsUrl) && (
          <section>
            <SectionLabel>Coordonnées de l'entreprise</SectionLabel>
            <div className="flex flex-col gap-1 rounded-lg border px-3 py-2">
              {address ? (
                <InfoRow icon={MapPin}>{address}</InfoRow>
              ) : null}
              {candidate.telephone ? (
                <InfoRow icon={Phone}>
                  <a
                    href={`tel:${candidate.telephone}`}
                    className="hover:underline"
                  >
                    {candidate.telephone}
                  </a>
                </InfoRow>
              ) : null}
              {candidate.siteWeb ? (
                <InfoRow icon={Globe}>
                  <a
                    href={candidate.siteWeb}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {stripScheme(candidate.siteWeb)}
                    <ExternalLink className="text-muted-foreground size-3" />
                  </a>
                </InfoRow>
              ) : null}
              {candidate.googleMapsUrl ? (
                <InfoRow icon={MapIcon}>
                  <a
                    href={candidate.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    Ouvrir dans Google Maps
                    <ExternalLink className="text-muted-foreground size-3" />
                  </a>
                </InfoRow>
              ) : null}
            </div>
          </section>
        )}

        {/* D'où viennent ces infos */}
        {sources.length > 0 && (
          <section>
            <SectionLabel>Sources consultées</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {sources.slice(0, 6).map((s, i) => (
                <a
                  key={i}
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer"
                  title={s.title || s.uri}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex max-w-56 items-center gap-1 truncate rounded-full border px-2.5 py-1 text-xs transition-colors"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">
                    {s.title || hostnameOf(s.uri)}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Pied : la décision ------------------------------------------------ */}
      <div className="shrink-0 space-y-2 border-t px-4 py-3 sm:px-6">
        {locked ? (
          <div className="flex items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            <Loader2 className="size-3.5 animate-spin" />
            Je complète encore les infos — quelques secondes…
          </div>
        ) : null}
        {isPending ? (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={onRefuse}
                disabled={busy || locked}
                className="flex-1 gap-2"
              >
                <X className="size-4" />
                Non merci
              </Button>
              <Button
                size="lg"
                onClick={onValidate}
                disabled={busy || locked}
                className="flex-[2] gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Ajouter à mes contacts
              </Button>
            </div>
            <p className="text-muted-foreground text-center text-[11px]">
              En l'ajoutant, je prépare sa fiche complète et je planifie ta
              première tâche : le contacter aujourd'hui.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-center text-sm">
            {candidate.status === 'validated'
              ? 'Déjà ajouté à tes contacts ✓'
              : 'Écarté — il ne te sera plus proposé.'}
          </p>
        )}
      </div>
    </>
  )
}

function Fact({
  label,
  icon: Icon,
  title,
  children,
}: {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <span
        className="flex items-center gap-1 truncate text-sm font-medium"
        title={title}
      >
        {Icon ? (
          <Icon className="text-muted-foreground size-3.5 shrink-0" />
        ) : null}
        {children}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground/80 mb-1.5 text-[11px] font-medium uppercase tracking-wide">
      {children}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  )
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function hostnameOf(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '')
  } catch {
    return uri
  }
}
