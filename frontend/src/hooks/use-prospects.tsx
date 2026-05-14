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
  FICHE_CLIENT_TEMPLATE,
  initialProspects,
  newId,
  type Prospect,
} from '@/lib/prospects'

type ProspectsContextValue = {
  prospects: Prospect[]
  loading: boolean
  getProspect: (id: string) => Prospect | undefined
  updateProspect: (next: Prospect) => void
  createProspect: () => string
  deleteProspect: (id: string) => void
}

const ProspectsContext = createContext<ProspectsContextValue | null>(null)

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setProspects(initialProspects)
      setLoading(false)
    }, 700)
    return () => clearTimeout(t)
  }, [])

  const getProspect = useCallback(
    (id: string) => prospects.find((p) => p.id === id),
    [prospects],
  )

  const updateProspect = useCallback((next: Prospect) => {
    setProspects((list) => {
      let changed = false
      const out = list.map((p) => {
        if (p.id !== next.id) return p
        if (p === next) return p
        changed = true
        return next
      })
      return changed ? out : list
    })
  }, [])

  const createProspect = useCallback(() => {
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
      website: null,
      ficheClient: FICHE_CLIENT_TEMPLATE,
      comments: [],
      status: 'À contacter',
    }
    setProspects((list) => [next, ...list])
    toast.success('Prospect créé')
    return id
  }, [])

  const deleteProspect = useCallback((id: string) => {
    setProspects((list) => list.filter((p) => p.id !== id))
    toast.success('Prospect supprimé')
  }, [])

  const value = useMemo<ProspectsContextValue>(
    () => ({
      prospects,
      loading,
      getProspect,
      updateProspect,
      createProspect,
      deleteProspect,
    }),
    [
      prospects,
      loading,
      getProspect,
      updateProspect,
      createProspect,
      deleteProspect,
    ],
  )

  return (
    <ProspectsContext.Provider value={value}>
      {children}
    </ProspectsContext.Provider>
  )
}

export function useProspects(): ProspectsContextValue {
  const ctx = useContext(ProspectsContext)
  if (!ctx) {
    throw new Error('useProspects must be used within ProspectsProvider')
  }
  return ctx
}
