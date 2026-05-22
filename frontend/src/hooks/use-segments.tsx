import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { type Segment } from '@/lib/prospects'
import {
  createSegment as apiCreateSegment,
  deleteSegment as apiDeleteSegment,
  listSegments as apiListSegments,
  updateSegment as apiUpdateSegment,
  type SegmentRecord,
} from '@/lib/segments-api'
import { EMPTY_SEGMENT_BRIEF, type SegmentBrief } from '@/lib/segments'

type SegmentsContextValue = {
  segments: Segment[]
  briefs: Record<Segment, SegmentBrief>
  loading: boolean
  getBrief: (segment: Segment) => SegmentBrief
  updateBrief: (segment: Segment, next: SegmentBrief) => void
  addSegment: (input?: Partial<SegmentBrief>) => Promise<Segment | null>
  deleteSegment: (segment: Segment) => void
}

const SegmentsContext = createContext<SegmentsContextValue | null>(null)

function toBrief(record: SegmentRecord): SegmentBrief {
  const { id: _id, ...brief } = record
  return brief
}

export function SegmentsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<SegmentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiListSegments()
      .then((data) => {
        if (!cancelled) setRecords(data)
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger les segments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const segments = useMemo<Segment[]>(() => records.map((r) => r.id), [records])

  const briefs = useMemo<Record<Segment, SegmentBrief>>(() => {
    const map: Record<Segment, SegmentBrief> = {}
    for (const r of records) map[r.id] = toBrief(r)
    return map
  }, [records])

  const getBrief = useCallback(
    (segment: Segment) => briefs[segment] ?? EMPTY_SEGMENT_BRIEF,
    [briefs],
  )

  const updateBrief = useCallback(
    (segment: Segment, next: SegmentBrief) => {
      let prev: SegmentRecord | undefined
      setRecords((rs) => {
        prev = rs.find((r) => r.id === segment)
        return rs.map((r) => (r.id === segment ? { ...r, ...next } : r))
      })
      apiUpdateSegment(segment, next)
        .then((updated) => {
          setRecords((rs) => rs.map((r) => (r.id === segment ? updated : r)))
        })
        .catch(() => {
          toast.error('Échec de la mise à jour')
          if (prev) {
            const snapshot = prev
            setRecords((rs) =>
              rs.map((r) => (r.id === segment ? snapshot : r)),
            )
          }
        })
    },
    [],
  )

  const addSegment = useCallback(
    async (input?: Partial<SegmentBrief>): Promise<Segment | null> => {
      try {
        const created = await apiCreateSegment({
          ...EMPTY_SEGMENT_BRIEF,
          nom: 'Nouveau segment',
          ...input,
        })
        setRecords((rs) => [created, ...rs])
        toast.success('Segment créé')
        return created.id
      } catch {
        toast.error('Échec de la création')
        return null
      }
    },
    [],
  )

  const deleteSegment = useCallback(
    (segment: Segment) => {
      let prev: SegmentRecord[] = []
      setRecords((rs) => {
        prev = rs
        return rs.filter((r) => r.id !== segment)
      })
      apiDeleteSegment(segment)
        .then(() => {
          toast.success('Segment supprimé')
        })
        .catch(() => {
          toast.error('Échec de la suppression')
          setRecords(prev)
        })
    },
    [],
  )

  const value = useMemo<SegmentsContextValue>(
    () => ({
      segments,
      briefs,
      loading,
      getBrief,
      updateBrief,
      addSegment,
      deleteSegment,
    }),
    [segments, briefs, loading, getBrief, updateBrief, addSegment, deleteSegment],
  )

  return (
    <SegmentsContext.Provider value={value}>
      {children}
    </SegmentsContext.Provider>
  )
}

export function useSegments(): SegmentsContextValue {
  const ctx = useContext(SegmentsContext)
  if (!ctx) {
    throw new Error('useSegments must be used within SegmentsProvider')
  }
  return ctx
}
