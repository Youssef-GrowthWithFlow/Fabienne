import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { CandidateCard } from '@/components/candidate-card'
import { CandidateSheet } from '@/components/candidate-sheet'
import { CreateSegmentDialog } from '@/components/create-segment-dialog'
import { SegmentSheet } from '@/components/segment-sheet'
import { SourcingProgress } from '@/components/sourcing-progress'
import { TagsField } from '@/components/tags-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import { useSegments } from '@/hooks/use-segments'
import { useSourcerHistory } from '@/hooks/use-sourcer-history'
import { getEntreprise } from '@/lib/entreprises-api'
import { getProspect } from '@/lib/prospects-api'
import { SEGMENT_NONE } from '@/lib/segment-constants'
import { cn } from '@/lib/utils'

const COUNT_CHOICES = [3, 5, 10] as const

function SegmentCard({
  label,
  selected,
  onClick,
  onEdit,
}: {
  label: string
  selected: boolean
  onClick: () => void
  /** Shows a pencil that opens the segment editor. */
  onEdit?: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
        selected
          ? 'border-foreground bg-foreground/[0.03] font-medium'
          : 'border-border hover:bg-muted/40',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {onEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          title="Modifier ce segment"
          aria-label="Modifier ce segment"
          className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded p-1.5 opacity-60 transition-opacity group-hover:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : null}
      {selected ? <Check className="size-4 shrink-0" /> : null}
    </div>
  )
}

export function Recherche() {
  const { segments, briefs, addSegment } = useSegments()
  const {
    candidates,
    loading,
    generating,
    runInProgress,
    phases,
    generate,
    validate,
    refuse,
    pickContact,
  } = useSourcerHistory()
  const { ingestMany } = useEntreprises()
  const { addProspect, replaceProspectLocal } = useProspects()
  const navigate = useNavigate()

  const [segmentId, setSegmentId] = useState<string>(SEGMENT_NONE)
  const [freeText, setFreeText] = useState('')
  const [count, setCount] = useState<number>(3)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Optional overrides — prefilled when a segment is picked, all optional.
  const [postes, setPostes] = useState<string[]>([])
  const [taille, setTaille] = useState('')
  const [activite, setActivite] = useState<string[]>([])
  const [zone, setZone] = useState<string[]>([])
  const [signaux, setSignaux] = useState<string[]>([])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editSegmentId, setEditSegmentId] = useState<string | null>(null)
  const [createSegmentOpen, setCreateSegmentOpen] = useState(false)

  useEffect(() => {
    if (segmentId === SEGMENT_NONE) {
      setPostes([])
      setTaille('')
      setActivite([])
      setZone([])
      setSignaux([])
      return
    }
    const b = briefs[segmentId]
    if (!b) return
    setPostes([...(b.postes ?? [])])
    setTaille(b.tailleStructure ?? '')
    setActivite([...(b.activiteCiblee ?? [])])
    setZone([...(b.zoneGeographique ?? [])])
    setSignaux([...(b.mustHave ?? [])])
  }, [segmentId, briefs])

  // When a streaming card (id = temp_id) gets persisted at end-of-run, its
  // entry is replaced by a row with the real DB id. Remap so the open sheet
  // doesn't force-close.
  useEffect(() => {
    if (!openId) return
    if (candidates.some((c) => c.id === openId)) return
    const promoted = candidates.find((c) => c.tempId === openId)
    setOpenId(promoted ? promoted.id : null)
  }, [candidates, openId])

  const hasSegment = segmentId !== SEGMENT_NONE
  const canLaunch =
    !runInProgress && (hasSegment || freeText.trim().length > 0)

  const finalInstruction = useMemo(() => {
    const overrides: string[] = []
    if (postes.length > 0) overrides.push(`Poste cible : ${postes.join(', ')}`)
    if (taille) overrides.push(`Taille : ${taille}`)
    if (activite.length > 0)
      overrides.push(`Activité ciblée : ${activite.join(', ')}`)
    if (zone.length > 0)
      overrides.push(`Zone géographique : ${zone.join(', ')}`)
    if (signaux.length > 0) overrides.push(`Signaux : ${signaux.join(', ')}`)
    const libre = freeText.trim()
    return [overrides.join(' — '), libre].filter(Boolean).join('. ')
  }, [postes, taille, activite, zone, signaux, freeText])

  function handleLaunch() {
    if (!canLaunch) return
    void generate({
      segmentId: hasSegment ? segmentId : null,
      count,
      instruction: finalInstruction,
    })
  }

  const pending = useMemo(
    () => candidates.filter((c) => c.status === 'pending'),
    [candidates],
  )
  const treated = useMemo(
    () => candidates.filter((c) => c.status !== 'pending'),
    [candidates],
  )

  async function handleValidate(id: string) {
    setBusyId(id)
    try {
      const res = await validate(id)
      if (res.entreprise) ingestMany([res.entreprise])
      if (res.prospect) addProspect(res.prospect)
      setOpenId(null)
      const nom = res.entreprise?.entreprise || res.prospect?.nom || 'Prospect'
      toast.success(`${nom} ajouté à tes contacts — je complète sa fiche…`, {
        action: { label: 'Voir', onClick: () => navigate('/contacts') },
      })
      // Background enrichment (fiche + contact) lands a few seconds after
      // validate returns. Poll twice so the data shows up on its own.
      const entrepriseId = res.entreprise?.id
      const prospectId = res.prospect?.id
      const refreshOnce = async () => {
        try {
          if (entrepriseId) ingestMany([await getEntreprise(entrepriseId)])
          if (prospectId) replaceProspectLocal(await getProspect(prospectId))
        } catch {
          /* soft-fail */
        }
      }
      window.setTimeout(refreshOnce, 8_000)
      window.setTimeout(refreshOnce, 20_000)
    } catch {
      toast.error("Je n'ai pas réussi à l'ajouter — réessaie.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleRefuse(id: string) {
    setBusyId(id)
    try {
      await refuse(id)
      setOpenId(null)
    } catch {
      toast.error('Ça n’a pas marché — réessaie.')
    } finally {
      setBusyId(null)
    }
  }

  const openCandidate = candidates.find((c) => c.id === openId) ?? null

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Trouver des prospects
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dis-moi qui tu cherches, je m'occupe du reste.
        </p>
      </div>

      {/* Launch card ------------------------------------------------------ */}
      <section className="space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Qui cherches-tu ?
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {segments.map((s) => (
              <SegmentCard
                key={s}
                label={briefs[s]?.nom || s}
                selected={segmentId === s}
                onClick={() => setSegmentId(s)}
                onEdit={() => setEditSegmentId(s)}
              />
            ))}
            <SegmentCard
              label="Autre chose (je décris)"
              selected={segmentId === SEGMENT_NONE}
              onClick={() => setSegmentId(SEGMENT_NONE)}
            />
            <button
              type="button"
              onClick={() => setCreateSegmentOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors"
            >
              <Plus className="size-4" />
              Nouveau segment
            </button>
          </div>
          {segmentId === SEGMENT_NONE ? (
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Ex : pharmacies indépendantes autour de Toulouse"
              rows={2}
              className="!text-sm"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Combien ?
          </Label>
          <div className="flex gap-1.5">
            {COUNT_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium tabular-nums transition-colors',
                  count === n
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input text-muted-foreground hover:bg-muted',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Les critères — toujours visibles, rien de caché */}
        {hasSegment ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3 sm:p-4">
            <div>
              <div className="text-sm font-medium">
                Les critères de cette recherche
              </div>
              <p className="text-muted-foreground text-xs">
                Pré-remplis depuis le segment — modifie ce que tu veux, tout
                est pris en compte.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Leur métier / rôle
                </Label>
                <TagsField
                  values={postes}
                  onChange={setPostes}
                  placeholder="Ex : Pharmacien titulaire"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Taille de la structure
                </Label>
                <Input
                  value={taille}
                  onChange={(e) => setTaille(e.target.value)}
                  placeholder="Ex : 2 à 5 salariés"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Type d'activité
                </Label>
                <TagsField
                  values={activite}
                  onChange={setActivite}
                  placeholder="Ex : Officine indépendante"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">Où ?</Label>
                <TagsField
                  values={zone}
                  onChange={setZone}
                  placeholder="Ex : Agglomération toulousaine"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Signes recherchés
                </Label>
                <TagsField
                  values={signaux}
                  onChange={setSignaux}
                  placeholder="Ex : Reprise récente"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Autre chose à préciser ?
                </Label>
                <Textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Ex : hors chaînes, indépendantes uniquement…"
                  rows={2}
                  className="!text-sm"
                />
              </div>
            </div>
          </div>
        ) : null}

        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={!canLaunch}
          className="w-full gap-2 bg-violet-600 text-white hover:bg-violet-700 sm:w-auto"
        >
          {runInProgress ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {runInProgress ? 'Recherche en cours…' : 'Lancer la recherche'}
        </Button>
      </section>

      {/* Progress + results ------------------------------------------------ */}
      {runInProgress ? (
        <SourcingProgress phases={phases} recovering={!generating} />
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : pending.length > 0 || generating ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">
              Nouveaux prospects à valider ({pending.length})
            </h3>
            <p className="text-muted-foreground text-xs">
              Ouvre chaque proposition pour voir le détail, puis ajoute-la à
              tes contacts ou écarte-la.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {pending.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                onOpen={() => setOpenId(c.id)}
                onValidate={() => handleValidate(c.id)}
                onRefuse={() => handleRefuse(c.id)}
                busy={busyId === c.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Historique (replié) ----------------------------------------------- */}
      {!loading && treated.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
          >
            Déjà traités ({treated.length})
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                historyOpen && 'rotate-180',
              )}
            />
          </button>
          {historyOpen ? (
            <div className="mt-3 flex flex-col gap-2">
              {treated.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  onOpen={() => setOpenId(c.id)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <CandidateSheet
        candidate={openCandidate}
        open={!!openCandidate}
        onOpenChange={(o) => !o && setOpenId(null)}
        onPickContact={(i) => openCandidate && pickContact(openCandidate.id, i)}
        onValidate={() => openCandidate && handleValidate(openCandidate.id)}
        onRefuse={() => openCandidate && handleRefuse(openCandidate.id)}
        busy={!!openCandidate && busyId === openCandidate.id}
      />

      {/* Édition / création de segment sans quitter la page */}
      {editSegmentId ? (
        <SegmentSheet
          segment={editSegmentId}
          onClose={() => setEditSegmentId(null)}
        />
      ) : null}
      <CreateSegmentDialog
        open={createSegmentOpen}
        onOpenChange={setCreateSegmentOpen}
        onCreate={async (input) => {
          const id = await addSegment(input)
          if (id) {
            setSegmentId(id)
            setEditSegmentId(id)
          }
        }}
      />
    </>
  )
}
