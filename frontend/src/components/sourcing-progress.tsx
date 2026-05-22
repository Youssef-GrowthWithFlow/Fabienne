import { Loader2 } from 'lucide-react'

import type { SourcerPhaseEvent } from '@/lib/sourcer-api'

type Props = {
  phases: SourcerPhaseEvent[]
  /** True when the sourcing is being tracked across a page refresh — no
   *  live phase events, just the polling-based recovery. */
  recovering?: boolean
}

/**
 * Persistent banner shown while a sourcing run is in flight. Tells the user
 * the run keeps running in background even if they refresh / close the tab,
 * and that new candidates will appear automatically when ready.
 */
export function SourcingProgress({ phases, recovering }: Props) {
  const last = phases[phases.length - 1]
  if (last?.phase === 'done') return null

  const liveMessage = last?.message ?? 'Recherche IA en lancement…'
  const headline = recovering
    ? 'Sourcing en cours en arrière-plan'
    : 'Sourcing en cours'

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="font-medium text-foreground">{headline}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          {recovering
            ? "Tu peux quitter cette page, les leads apparaîtront ici dès qu'ils sont prêts."
            : `${liveMessage} — typiquement 20-30 s. Tu peux fermer l'onglet, le sourcing continue côté serveur et les leads remonteront automatiquement.`}
        </div>
      </div>
    </div>
  )
}
