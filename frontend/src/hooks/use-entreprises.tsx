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

import {
  createEntreprise as apiCreateEntreprise,
  deleteEntreprise as apiDeleteEntreprise,
  listEntreprises as apiListEntreprises,
  updateEntreprise as apiUpdateEntreprise,
} from '@/lib/entreprises-api'
import type { EntrepriseRecord } from '@/lib/entreprises'
import type { Segment } from '@/lib/prospects'

type EntreprisesContextValue = {
  entreprises: EntrepriseRecord[]
  loading: boolean
  getById: (id: string) => EntrepriseRecord | undefined
  bySegment: (segmentId: Segment) => EntrepriseRecord[]
  refresh: () => Promise<void>
  ingestMany: (list: EntrepriseRecord[]) => void
  addEntreprise: (
    payload: Omit<EntrepriseRecord, 'id' | 'dateAjout'>,
  ) => Promise<EntrepriseRecord | null>
  updateEntreprise: (
    id: string,
    patch: Partial<EntrepriseRecord>,
  ) => Promise<void>
  deleteEntreprise: (id: string) => Promise<void>
}

const EntreprisesContext = createContext<EntreprisesContextValue | null>(null)

export function EntreprisesProvider({ children }: { children: ReactNode }) {
  const [entreprises, setEntreprises] = useState<EntrepriseRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await apiListEntreprises()
      setEntreprises(data)
    } catch {
      toast.error('Impossible de charger les entreprises')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiListEntreprises()
      .then((data) => {
        if (!cancelled) setEntreprises(data)
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger les entreprises')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const getById = useCallback(
    (id: string) => entreprises.find((e) => e.id === id),
    [entreprises],
  )

  const bySegment = useCallback(
    (segmentId: Segment) =>
      entreprises
        .filter((e) => e.segmentId === segmentId)
        .sort((a, b) => (a.dateAjout < b.dateAjout ? 1 : -1)),
    [entreprises],
  )

  const ingestMany = useCallback((list: EntrepriseRecord[]) => {
    if (list.length === 0) return
    setEntreprises((prev) => {
      const ids = new Set(list.map((e) => e.id))
      const filtered = prev.filter((e) => !ids.has(e.id))
      return [...list, ...filtered]
    })
  }, [])

  const addEntreprise = useCallback(
    async (
      payload: Omit<EntrepriseRecord, 'id' | 'dateAjout'>,
    ): Promise<EntrepriseRecord | null> => {
      try {
        const created = await apiCreateEntreprise(payload)
        setEntreprises((prev) => [created, ...prev])
        return created
      } catch {
        toast.error('Échec de la création')
        return null
      }
    },
    [],
  )

  const updateEntreprise = useCallback(
    async (id: string, patch: Partial<EntrepriseRecord>) => {
      let prev: EntrepriseRecord | undefined
      setEntreprises((list) => {
        prev = list.find((e) => e.id === id)
        return list.map((e) => (e.id === id ? { ...e, ...patch } : e))
      })
      try {
        const updated = await apiUpdateEntreprise(id, patch)
        setEntreprises((list) => list.map((e) => (e.id === id ? updated : e)))
      } catch {
        toast.error('Échec de la mise à jour')
        if (prev) {
          const snap = prev
          setEntreprises((list) => list.map((e) => (e.id === id ? snap : e)))
        }
      }
    },
    [],
  )

  const deleteEntreprise = useCallback(async (id: string) => {
    let prev: EntrepriseRecord[] = []
    setEntreprises((list) => {
      prev = list
      return list.filter((e) => e.id !== id)
    })
    try {
      await apiDeleteEntreprise(id)
      toast.success('Entreprise supprimée')
    } catch {
      toast.error('Échec de la suppression')
      setEntreprises(prev)
    }
  }, [])

  const value = useMemo<EntreprisesContextValue>(
    () => ({
      entreprises,
      loading,
      getById,
      bySegment,
      refresh,
      ingestMany,
      addEntreprise,
      updateEntreprise,
      deleteEntreprise,
    }),
    [
      entreprises,
      loading,
      getById,
      bySegment,
      refresh,
      ingestMany,
      addEntreprise,
      updateEntreprise,
      deleteEntreprise,
    ],
  )

  return (
    <EntreprisesContext.Provider value={value}>
      {children}
    </EntreprisesContext.Provider>
  )
}

export function useEntreprises(): EntreprisesContextValue {
  const ctx = useContext(EntreprisesContext)
  if (!ctx) {
    throw new Error('useEntreprises must be used within EntreprisesProvider')
  }
  return ctx
}
