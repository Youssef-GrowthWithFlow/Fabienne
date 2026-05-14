import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { INITIAL_SEGMENT_IDS, newId, type Segment } from '@/lib/prospects'
import {
  EMPTY_SEGMENT_BRIEF,
  INITIAL_BRIEFS,
  type SegmentBrief,
} from '@/lib/segments'

type SegmentsContextValue = {
  segments: Segment[]
  briefs: Record<Segment, SegmentBrief>
  getBrief: (segment: Segment) => SegmentBrief
  updateBrief: (segment: Segment, next: SegmentBrief) => void
  addSegment: () => Segment
  deleteSegment: (segment: Segment) => void
}

const SegmentsContext = createContext<SegmentsContextValue | null>(null)

export function SegmentsProvider({ children }: { children: ReactNode }) {
  const [segments, setSegments] = useState<Segment[]>(INITIAL_SEGMENT_IDS)
  const [briefs, setBriefs] =
    useState<Record<Segment, SegmentBrief>>(INITIAL_BRIEFS)

  const getBrief = useCallback(
    (segment: Segment) => briefs[segment] ?? EMPTY_SEGMENT_BRIEF,
    [briefs],
  )

  const updateBrief = useCallback(
    (segment: Segment, next: SegmentBrief) => {
      setBriefs((prev) => ({ ...prev, [segment]: next }))
    },
    [],
  )

  const addSegment = useCallback(() => {
    const id = newId('seg')
    setBriefs((prev) => ({
      ...prev,
      [id]: { ...EMPTY_SEGMENT_BRIEF, nom: 'Nouveau segment' },
    }))
    setSegments((prev) => [id, ...prev])
    toast.success('Segment créé')
    return id
  }, [])

  const deleteSegment = useCallback((segment: Segment) => {
    setSegments((prev) => prev.filter((s) => s !== segment))
    setBriefs((prev) => {
      const { [segment]: _, ...rest } = prev
      return rest
    })
    toast.success('Segment supprimé')
  }, [])

  const value = useMemo<SegmentsContextValue>(
    () => ({
      segments,
      briefs,
      getBrief,
      updateBrief,
      addSegment,
      deleteSegment,
    }),
    [segments, briefs, getBrief, updateBrief, addSegment, deleteSegment],
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
