import { Loader2, Sparkles, Telescope } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { CandidateCard } from '@/components/candidate-card'
import { CandidateSheet } from '@/components/candidate-sheet'
import { SourcerLaunchDrawer } from '@/components/sourcer-launch-drawer'
import { SourcingProgress } from '@/components/sourcing-progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import { useSourcerHistory } from '@/hooks/use-sourcer-history'
import { getEntreprise } from '@/lib/entreprises-api'
import { getProspect } from '@/lib/prospects-api'

type Filter = 'pending' | 'history'

export function Sourcer() {
  const {
    candidates,
    loading,
    generating,
    runInProgress,
    phases,
    validate,
    refuse,
    pickContact,
  } = useSourcerHistory()
  const { ingestMany } = useEntreprises()
  const { addProspect, replaceProspectLocal } = useProspects()
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [launchOpen, setLaunchOpen] = useState(false)

  useEffect(() => {
    if (runInProgress) setFilter('pending')
  }, [runInProgress])

  // When a streaming card (id = temp_id) gets persisted at end-of-run, its
  // entry is replaced by a row with the real DB id. The sheet's openId would
  // dangle and force-close. Map temp_id → real id when we can.
  useEffect(() => {
    if (!openId) return
    if (candidates.some((c) => c.id === openId)) return
    const promoted = candidates.find((c) => c.tempId === openId)
    setOpenId(promoted ? promoted.id : null)
  }, [candidates, openId])

  const counts = useMemo(() => {
    let pending = 0
    let history = 0
    for (const c of candidates) {
      if (c.status === 'pending') pending++
      else history++
    }
    return { pending, history }
  }, [candidates])

  const filtered = useMemo(() => {
    if (filter === 'pending') {
      return candidates.filter((c) => c.status === 'pending')
    }
    return candidates.filter((c) => c.status !== 'pending')
  }, [candidates, filter])

  async function handleValidate(id: string) {
    setBusyId(id)
    try {
      const res = await validate(id)
      if (res.entreprise) ingestMany([res.entreprise])
      if (res.prospect) addProspect(res.prospect)
      setOpenId(null)
      toast.success('Lead ajouté — enrichissement en cours…', {
        action: {
          label: 'Voir',
          onClick: () => navigate('/entreprises'),
        },
      })
      // Background enrichment (Gemini fiche + DropContact contact) finishes
      // a few seconds after validate returns. Poll twice to pick up the
      // fresh data without making the user refresh manually.
      const entrepriseId = res.entreprise?.id
      const prospectId = res.prospect?.id
      const refreshOnce = async () => {
        try {
          if (entrepriseId) {
            const ent = await getEntreprise(entrepriseId)
            ingestMany([ent])
          }
          if (prospectId) {
            const p = await getProspect(prospectId)
            replaceProspectLocal(p)
          }
        } catch {
          /* soft-fail — user can refresh manually */
        }
      }
      window.setTimeout(refreshOnce, 8_000)
      window.setTimeout(refreshOnce, 20_000)
    } catch {
      toast.error("Échec de l'ajout.")
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
      toast.error('Échec du refus.')
    } finally {
      setBusyId(null)
    }
  }

  const openCandidate = candidates.find((c) => c.id === openId) ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* Header — pattern aligné sur Entreprises/Prospects --------------- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Telescope className="size-5 text-primary" />
            Trouver de nouveaux leads
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.pending > 0
              ? `${counts.pending} lead${counts.pending > 1 ? 's' : ''} à regarder — à toi de jouer.`
              : 'Lance une recherche, je m’occupe de trouver les bons profils.'}
          </p>
        </div>
        <Button
          onClick={() => setLaunchOpen(true)}
          className="gap-1.5"
          disabled={runInProgress}
        >
          {runInProgress ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Sourcer
        </Button>
      </div>

      {/* Onglets À valider / Historique ---------------------------------- */}
      <Tabs
        value={filter}
        onValueChange={(v: string) => setFilter(v as Filter)}
      >
        <TabsList>
          <TabsTrigger value="pending">
            À valider {counts.pending > 0 && `(${counts.pending})`}
          </TabsTrigger>
          <TabsTrigger value="history">
            Historique {counts.history > 0 && `(${counts.history})`}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Liste ------------------------------------------------------------ */}
      {runInProgress && filter === 'pending' && (
        <SourcingProgress phases={phases} recovering={!generating} />
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 && !generating ? (
        <EmptyState tab={filter} onLaunch={() => setLaunchOpen(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              onOpen={() => setOpenId(c.id)}
            />
          ))}
        </div>
      )}

      {/* Sheet de détail -------------------------------------------------- */}
      <CandidateSheet
        candidate={openCandidate}
        open={!!openCandidate}
        onOpenChange={(o) => !o && setOpenId(null)}
        onPickContact={(i) => openCandidate && pickContact(openCandidate.id, i)}
        onValidate={() => openCandidate && handleValidate(openCandidate.id)}
        onRefuse={() => openCandidate && handleRefuse(openCandidate.id)}
        busy={!!openCandidate && busyId === openCandidate.id}
      />

      {/* Drawer de lancement ---------------------------------------------- */}
      <SourcerLaunchDrawer open={launchOpen} onOpenChange={setLaunchOpen} />
    </div>
  )
}

function EmptyState({
  tab,
  onLaunch,
}: {
  tab: Filter
  onLaunch: () => void
}) {
  if (tab === 'pending') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        <p>Aucun lead à valider.</p>
        <Button size="sm" onClick={onLaunch} className="gap-1.5">
          <Sparkles className="size-3.5" />
          Lancer un sourcing
        </Button>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      Rien dans l'historique.
    </div>
  )
}
