import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import type { ProposedEntreprise } from '@/lib/entreprises'
import {
  listSourcedCandidates,
  refuseSourcedCandidate,
  runSourcingStream,
  updateSourcedCandidate,
  validateSourcedCandidate,
  type SourcedCandidate,
  type SourcerPhaseEvent,
  type SourcerRunRequest,
} from '@/lib/sourcer-api'

export type CandidateStatus = 'pending' | 'validated' | 'refused'

/** Flattened view of a SourcedCandidate row — payload spread + metadata. */
export type SourcerCandidate = ProposedEntreprise & {
  id: string
  status: CandidateStatus
  mainContactIndex: number
  createdAt: string
  /** True while a raw card is awaiting its `candidate_enriched` SSE patch.
   *  Persisted entries from history never have this flag. */
  enriching?: boolean
  /** False for streaming cards (id is a temp_id), true once persisted. */
  persisted?: boolean
}

function toView(c: SourcedCandidate): SourcerCandidate {
  return {
    ...c.payload,
    contacts: c.payload.contacts ?? [],
    id: c.id,
    status: c.status,
    mainContactIndex: c.mainContactIndex,
    createdAt: c.createdAt,
    persisted: true,
  }
}

// ---------------------------------------------------------------------------
// Cross-refresh "sourcing in progress" tracking
// ---------------------------------------------------------------------------
// The backend runner is detached from the SSE connection (run/stream spawns a
// background task), so closing the tab or refreshing does NOT cancel the run.
// We still want the user to be aware that a run is ongoing in that case.
//
// Strategy:
//   1. When `generate()` starts, write a marker to localStorage with the
//      pre-run snapshot of persisted candidate IDs and a start timestamp.
//   2. On hook mount (and after refresh), read the marker. If it's recent
//      (< MAX_RUN_AGE_MS) AND no new candidates have appeared since
//      `startedAt`, we're still waiting → set `recovering = true` and poll
//      `listSourcedCandidates` every POLL_INTERVAL_MS.
//   3. When new persisted candidates appear (ids not in the pre-run snapshot
//      AND createdAt > startedAt), clear the marker, toast, stop polling.
//   4. Hard timeout — after MAX_RUN_AGE_MS we give up and clear the marker
//      regardless, to avoid a stuck spinner.

const STORAGE_KEY = 'fabienne.sourcing.activeRun.v1'
const MAX_RUN_AGE_MS = 5 * 60 * 1000 // 5 min — generous, real runs finish in ~30 s
const POLL_INTERVAL_MS = 7_000

type ActiveRunMarker = {
  startedAt: string // ISO
  snapshotIds: string[]
}

function readMarker(): ActiveRunMarker | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveRunMarker
    if (!parsed.startedAt || !Array.isArray(parsed.snapshotIds)) return null
    if (Date.now() - new Date(parsed.startedAt).getTime() > MAX_RUN_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeMarker(m: ActiveRunMarker): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch {
    /* quota / SSR safety — non-blocking */
  }
}

function clearMarker(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* no-op */
  }
}

type SourcerContextValue = {
  candidates: SourcerCandidate[]
  loading: boolean
  generating: boolean
  /** True when a sourcing run is in progress in the background (either
   *  freshly launched in this tab, or recovered from a previous tab via
   *  localStorage). UI should display a "ça arrive, reviens plus tard"
   *  banner. */
  runInProgress: boolean
  /** Live phases received via SSE during the current `generate()` call.
   *  Excludes per-candidate events (those drive `candidates` directly). */
  phases: SourcerPhaseEvent[]
  refresh: () => Promise<void>
  generate: (req: SourcerRunRequest) => Promise<SourcerCandidate[]>
  validate: (id: string) => ReturnType<typeof validateSourcedCandidate>
  refuse: (id: string) => Promise<void>
  pickContact: (id: string, mainContactIndex: number) => Promise<void>
}

const SourcerContext = createContext<SourcerContextValue | null>(null)

export function SourcerProvider({ children }: { children: ReactNode }) {
  const [persisted, setPersisted] = useState<SourcerCandidate[]>([])
  const [streaming, setStreaming] = useState<SourcerCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [phases, setPhases] = useState<SourcerPhaseEvent[]>([])
  const [recovering, setRecovering] = useState(false)
  // Tracks the active marker in memory to detect "new candidates since the
  // run started" without re-reading localStorage on every render.
  const activeMarkerRef = useRef<ActiveRunMarker | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await listSourcedCandidates()
      setPersisted(data.map(toView))
      return data.map(toView)
    } catch {
      toast.error("Impossible de charger l'historique du sourcing")
      return []
    }
  }, [])

  // Initial load + cross-refresh recovery detection.
  useEffect(() => {
    let cancelled = false
    listSourcedCandidates()
      .then((data) => {
        if (cancelled) return
        const views = data.map(toView)
        setPersisted(views)
        // After history loads, decide whether a run is still in flight.
        const marker = readMarker()
        if (marker) {
          const startedAt = new Date(marker.startedAt).getTime()
          const newOnes = views.filter(
            (c) =>
              !marker.snapshotIds.includes(c.id) &&
              new Date(c.createdAt).getTime() >= startedAt,
          )
          if (newOnes.length > 0) {
            // The detached runner finished while we were away — pick up
            // and clear the marker silently (no toast, user wasn't waiting).
            clearMarker()
          } else {
            activeMarkerRef.current = marker
            setRecovering(true)
          }
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de charger l'historique")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Poll while recovering. Stops as soon as new candidates arrive.
  useEffect(() => {
    if (!recovering) return
    let stopped = false
    const tick = async () => {
      const marker = activeMarkerRef.current
      if (!marker) {
        setRecovering(false)
        return
      }
      // Hard timeout safety net.
      if (Date.now() - new Date(marker.startedAt).getTime() > MAX_RUN_AGE_MS) {
        clearMarker()
        activeMarkerRef.current = null
        setRecovering(false)
        return
      }
      try {
        const data = await listSourcedCandidates()
        if (stopped) return
        const views = data.map(toView)
        setPersisted(views)
        const startedAtMs = new Date(marker.startedAt).getTime()
        const newOnes = views.filter(
          (c) =>
            !marker.snapshotIds.includes(c.id) &&
            new Date(c.createdAt).getTime() >= startedAtMs,
        )
        if (newOnes.length > 0) {
          clearMarker()
          activeMarkerRef.current = null
          setRecovering(false)
          toast.success(
            `${newOnes.length} nouveau${newOnes.length > 1 ? 'x' : ''} prospect${
              newOnes.length > 1 ? 's' : ''
            } prêt${newOnes.length > 1 ? 's' : ''} !`,
          )
        }
      } catch {
        /* keep polling */
      }
    }
    const id = window.setInterval(tick, POLL_INTERVAL_MS)
    // Fire one immediately so we don't wait the full interval on mount.
    void tick()
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [recovering])

  const generate = useCallback(async (req: SourcerRunRequest) => {
    // Snapshot the current persisted ids so the recovery detection knows
    // exactly which candidates pre-existed the run.
    const snapshotIds = persisted.map((c) => c.id)
    const marker: ActiveRunMarker = {
      startedAt: new Date().toISOString(),
      snapshotIds,
    }
    writeMarker(marker)
    activeMarkerRef.current = marker
    setGenerating(true)
    setPhases([])
    setStreaming([])
    try {
      const result = await runSourcingStream(req, (event) => {
        if (event.type !== 'phase') return
        if (event.phase === 'candidate_raw') {
          const data = event.data as ProposedEntreprise
          setStreaming((prev) => [
            ...prev,
            {
              ...data,
              contacts: data.contacts ?? [],
              id: event.temp_id,
              status: 'pending',
              mainContactIndex: 0,
              createdAt: new Date().toISOString(),
              enriching: true,
              persisted: false,
            },
          ])
        } else if (event.phase === 'candidate_enriched') {
          const data = event.data as ProposedEntreprise
          setStreaming((prev) =>
            prev.map((c) =>
              c.id === event.temp_id
                ? {
                    ...c,
                    ...data,
                    contacts: data.contacts ?? [],
                    enriching: false,
                  }
                : c,
            ),
          )
        } else if (event.phase === 'candidate_dropped') {
          setStreaming((prev) => prev.filter((c) => c.id !== event.temp_id))
        } else {
          setPhases((prev) => [...prev, event])
        }
      })
      const views = result.candidates.map(toView)
      setPersisted((prev) => [...views, ...prev])
      setStreaming([])
      clearMarker()
      activeMarkerRef.current = null
      if (views.length === 0) {
        toast.error("L'IA n'a trouvé aucun candidat.")
      } else {
        toast.success(
          `${views.length} candidat${views.length > 1 ? 's' : ''} trouvé${views.length > 1 ? 's' : ''}.`,
        )
      }
      return views
    } catch (err) {
      // Streaming failed (e.g. tab refreshed) — but the runner is detached
      // and keeps going. Leave the marker in place so recovery polling
      // picks it up.
      const msg =
        err instanceof Error ? err.message : 'Stream interrompu — le sourcing continue en background.'
      toast.message(msg)
      setRecovering(true)
      return []
    } finally {
      setGenerating(false)
      setStreaming([])
    }
  }, [persisted])

  const validate = useCallback(async (id: string) => {
    const res = await validateSourcedCandidate(id)
    setPersisted((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'validated' } : c)),
    )
    return res
  }, [])

  const refuse = useCallback(async (id: string) => {
    await refuseSourcedCandidate(id)
    setPersisted((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'refused' } : c)),
    )
  }, [])

  const pickContact = useCallback(
    async (id: string, mainContactIndex: number) => {
      setPersisted((prev) =>
        prev.map((c) => (c.id === id ? { ...c, mainContactIndex } : c)),
      )
      try {
        await updateSourcedCandidate(id, { mainContactIndex })
      } catch {
        toast.error('Impossible de mettre à jour le contact principal.')
        refresh()
      }
    },
    [refresh],
  )

  // Streaming cards first (they're the freshest), then the persisted history.
  const candidates = useMemo(
    () => [...streaming, ...persisted],
    [streaming, persisted],
  )

  const value: SourcerContextValue = {
    candidates,
    loading,
    generating,
    runInProgress: generating || recovering,
    phases,
    refresh: async () => {
      await refresh()
    },
    generate,
    validate,
    refuse,
    pickContact,
  }

  return (
    <SourcerContext.Provider value={value}>{children}</SourcerContext.Provider>
  )
}

export function useSourcerHistory(): SourcerContextValue {
  const ctx = useContext(SourcerContext)
  if (!ctx) {
    throw new Error('useSourcerHistory must be used within SourcerProvider')
  }
  return ctx
}
