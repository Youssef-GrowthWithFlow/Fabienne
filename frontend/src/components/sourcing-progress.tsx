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

  const liveMessage = last?.message ?? 'Je commence à chercher…'
  const headline = recovering
    ? 'Je continue à chercher en fond'
    : 'Je cherche pour toi'

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="font-medium text-foreground">{headline}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          {recovering
            ? 'Tu peux fermer l’onglet, je te montre les prospects dès qu’ils arrivent.'
            : `${liveMessage} — compte 1 à 2 minutes. Tu peux fermer l’onglet, je continue et les prospects apparaîtront ici.`}
        </div>
      </div>
    </div>
  )
}
