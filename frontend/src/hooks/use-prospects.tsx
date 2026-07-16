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

import { fireConfetti } from '@/lib/confetti'
import {
  todayIso,
  type Comment,
  type Prospect,
} from '@/lib/prospects'
import {
  createProspect as apiCreateProspect,
  deleteProspect as apiDeleteProspect,
  listProspects as apiListProspects,
  updateProspect as apiUpdateProspect,
} from '@/lib/prospects-api'
import {
  createAction as apiCreateAction,
  listActions as apiListActions,
  type ActionRecord,
} from '@/lib/actions-api'
import type { ActivityKind } from '@/lib/prospects'
import {
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
  updateComment as apiUpdateComment,
} from '@/lib/comments-api'

const ACTIONS_HISTORY_DAYS = 90

function actionsSinceIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - ACTIONS_HISTORY_DAYS)
  return d.toISOString()
}

type ProspectsContextValue = {
  prospects: Prospect[]
  actions: ActionRecord[]
  loading: boolean
  getProspect: (id: string) => Prospect | undefined
  updateProspect: (next: Prospect) => void
  replaceProspectLocal: (next: Prospect) => void
  createProspect: (
    input?: Partial<Omit<Prospect, 'id' | 'comments'>> & {
      /** Free-text company name — the backend finds or creates it. */
      entrepriseNom?: string
    },
  ) => Promise<string | null>
  addProspect: (prospect: Prospect) => void
  deleteProspect: (id: string) => void
  addComment: (prospectId: string, texte: string) => Promise<void>
  updateComment: (
    prospectId: string,
    commentId: string,
    texte: string,
  ) => Promise<void>
  deleteComment: (prospectId: string, commentId: string) => Promise<void>
  logAction: (
    prospectId: string,
    kind: ActivityKind,
    metadata?: Record<string, unknown>,
    at?: string,
  ) => Promise<void>
}

const ProspectsContext = createContext<ProspectsContextValue | null>(null)

function emptyProspect(): Omit<Prospect, 'id'> {
  return {
    nom: '',
    role: '',
    entrepriseId: null,
    entreprise: null,
    telephone: '',
    email: '',
    linkedin: null,
    fieldSources: {},
    comments: [],
    status: 'À contacter',
    createdAt: todayIso(),
    contactedAt: null,
    relanceDate: null,
    relanceNote: '',
    enrichmentStatus: 'none',
  }
}

// Completing a task deserves better than « Action enregistrée » — a small
// confetti burst + a warm message. Big burst for the milestones.
const CELEBRATIONS: Partial<
  Record<ActivityKind, { messages: string[]; big?: boolean }>
> = {
  message: {
    messages: [
      'Message envoyé — bien joué 💪',
      'Et un contact de plus ✨',
      'Ça, c’est fait 👏',
    ],
  },
  reply: {
    messages: ['Une réponse — ça mord ! 🎣', 'Excellente nouvelle 🙌'],
  },
  discussion: { messages: ['En discussion — continue comme ça 💬'] },
  meeting: { messages: ['RDV pris 🤝 Superbe !'], big: true },
  won: { messages: ['Client gagné 🏆 Bravo !'], big: true },
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [actions, setActions] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refreshActions = useCallback(async () => {
    try {
      const data = await apiListActions({ since: actionsSinceIso() })
      setActions(data)
    } catch {
      // ignore — the feed refreshes on the next mutation
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiListProspects()
      .then((data) => {
        if (!cancelled) setProspects(data)
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger les prospects')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    apiListActions({ since: actionsSinceIso() })
      .then((data) => {
        if (!cancelled) setActions(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const getProspect = useCallback(
    (id: string) => prospects.find((p) => p.id === id),
    [prospects],
  )

  const updateProspect = useCallback(
    (next: Prospect) => {
      let prev: Prospect | undefined
      let adjusted: Prospect | undefined
      setProspects((list) => {
        prev = list.find((p) => p.id === next.id)
        if (!prev) return list
        const isNowContacted =
          next.status !== 'À contacter' && prev.status === 'À contacter'
        adjusted =
          isNowContacted && !next.contactedAt
            ? { ...next, contactedAt: todayIso() }
            : next
        return list.map((p) => (p.id === adjusted!.id ? adjusted! : p))
      })
      if (!prev || !adjusted) return

      const snapshot = prev
      const sent = adjusted
      apiUpdateProspect(sent.id, sent)
        .then((updated) => {
          setProspects((list) =>
            list.map((p) => (p.id === updated.id ? updated : p)),
          )
          if (snapshot.status !== sent.status) refreshActions()
        })
        .catch(() => {
          toast.error('Échec de la mise à jour')
          setProspects((list) =>
            list.map((p) => (p.id === snapshot.id ? snapshot : p)),
          )
        })
    },
    [refreshActions],
  )

  const replaceProspectLocal = useCallback((next: Prospect) => {
    setProspects((list) =>
      list.map((p) => (p.id === next.id ? next : p)),
    )
  }, [])

  const createProspect = useCallback(
    async (
      input?: Partial<Omit<Prospect, 'id' | 'comments'>> & {
        entrepriseNom?: string
      },
    ): Promise<string | null> => {
      try {
        const draft = { ...emptyProspect(), ...input, id: '' } as Prospect
        const created = await apiCreateProspect(draft)
        setProspects((list) => [created, ...list])
        toast.success('Prospect créé')
        refreshActions()
        return created.id
      } catch {
        toast.error('Échec de la création')
        return null
      }
    },
    [refreshActions],
  )

  const addProspect = useCallback(
    (prospect: Prospect) => {
      let inserted = false
      setProspects((list) => {
        if (list.some((p) => p.id === prospect.id)) return list
        inserted = true
        return [prospect, ...list]
      })
      if (inserted) refreshActions()
    },
    [refreshActions],
  )

  const deleteProspect = useCallback(
    (id: string) => {
      let prev: Prospect[] = []
      setProspects((list) => {
        prev = list
        return list.filter((p) => p.id !== id)
      })
      apiDeleteProspect(id)
        .then(() => {
          toast.success('Prospect supprimé')
          refreshActions()
        })
        .catch(() => {
          toast.error('Échec de la suppression')
          setProspects(prev)
        })
    },
    [refreshActions],
  )

  const setProspectComments = useCallback(
    (prospectId: string, mutate: (cs: Comment[]) => Comment[]) => {
      setProspects((list) =>
        list.map((p) =>
          p.id === prospectId ? { ...p, comments: mutate(p.comments) } : p,
        ),
      )
    },
    [],
  )

  const addComment = useCallback(
    async (prospectId: string, texte: string): Promise<void> => {
      try {
        const created = await apiCreateComment(prospectId, {
          date: new Date().toISOString(),
          texte,
        })
        setProspectComments(prospectId, (cs) => [created, ...cs])
        toast.success('Commentaire ajouté')
      } catch {
        toast.error('Échec de l’ajout du commentaire')
      }
    },
    [setProspectComments],
  )

  const updateComment = useCallback(
    async (
      prospectId: string,
      commentId: string,
      texte: string,
    ): Promise<void> => {
      let previous: Comment | undefined
      setProspectComments(prospectId, (cs) => {
        previous = cs.find((c) => c.id === commentId)
        return cs.map((c) => (c.id === commentId ? { ...c, texte } : c))
      })
      try {
        const updated = await apiUpdateComment(prospectId, commentId, { texte })
        setProspectComments(prospectId, (cs) =>
          cs.map((c) => (c.id === commentId ? updated : c)),
        )
      } catch {
        toast.error('Échec de la mise à jour du commentaire')
        if (previous) {
          const snapshot = previous
          setProspectComments(prospectId, (cs) =>
            cs.map((c) => (c.id === commentId ? snapshot : c)),
          )
        }
      }
    },
    [setProspectComments],
  )

  const deleteComment = useCallback(
    async (prospectId: string, commentId: string): Promise<void> => {
      let previous: Comment[] = []
      setProspectComments(prospectId, (cs) => {
        previous = cs
        return cs.filter((c) => c.id !== commentId)
      })
      try {
        await apiDeleteComment(prospectId, commentId)
        toast.success('Commentaire supprimé')
      } catch {
        toast.error('Échec de la suppression du commentaire')
        setProspectComments(prospectId, () => previous)
      }
    },
    [setProspectComments],
  )

  const logAction = useCallback(
    async (
      prospectId: string,
      kind: ActivityKind,
      metadata?: Record<string, unknown>,
      at?: string,
    ): Promise<void> => {
      try {
        const { prospect: fresh } = await apiCreateAction(prospectId, {
          kind,
          metadata,
          at,
        })
        setProspects((list) =>
          list.map((p) => (p.id === prospectId ? fresh : p)),
        )
        refreshActions()
        const celebration = CELEBRATIONS[kind]
        if (celebration) {
          fireConfetti(celebration.big ? 'big' : 'small')
          toast.success(pick(celebration.messages))
        } else {
          toast.success('C’est noté.')
        }
      } catch {
        toast.error('Échec de l’action')
      }
    },
    [refreshActions],
  )

  const value = useMemo<ProspectsContextValue>(
    () => ({
      prospects,
      actions,
      loading,
      getProspect,
      updateProspect,
      replaceProspectLocal,
      createProspect,
      addProspect,
      deleteProspect,
      addComment,
      updateComment,
      deleteComment,
      logAction,
    }),
    [
      prospects,
      actions,
      loading,
      getProspect,
      updateProspect,
      replaceProspectLocal,
      createProspect,
      addProspect,
      deleteProspect,
      addComment,
      updateComment,
      deleteComment,
      logAction,
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
