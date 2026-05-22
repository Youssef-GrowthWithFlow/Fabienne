import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { listActions, type ActionRecord } from '@/lib/actions-api'

const HISTORY_DAYS = 90

function sinceIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - HISTORY_DAYS)
  return d.toISOString()
}

type ActionsContextValue = {
  actions: ActionRecord[]
  loading: boolean
  refresh: () => Promise<void>
}

const ActionsContext = createContext<ActionsContextValue | null>(null)

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await listActions({ since: sinceIso() })
      setActions(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listActions({ since: sinceIso() })
      .then((data) => {
        if (!cancelled) setActions(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<ActionsContextValue>(
    () => ({ actions, loading, refresh }),
    [actions, loading, refresh],
  )

  return (
    <ActionsContext.Provider value={value}>{children}</ActionsContext.Provider>
  )
}

export function useActions(): ActionsContextValue {
  const ctx = useContext(ActionsContext)
  if (!ctx) {
    throw new Error('useActions must be used within ActionsProvider')
  }
  return ctx
}
