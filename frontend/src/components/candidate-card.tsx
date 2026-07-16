import { Check, ChevronRight, Loader2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SourcerCandidate } from '@/hooks/use-sourcer-history'

const MAX_SIGNAUX_INLINE = 3

/** Compact row for a sourced candidate — the decision itself happens in the
 *  ValidationReview, this card just opens it. */
export function CandidateCard({
  candidate,
  onOpen,
}: {
  candidate: SourcerCandidate
  onOpen: () => void
}) {
  const main = candidate.contacts[candidate.mainContactIndex]
  const signaux = candidate.signaux ?? []
  const visibleSignaux = signaux.slice(0, MAX_SIGNAUX_INLINE)
  const extraSignaux = signaux.length - visibleSignaux.length
  const status = candidate.status
  const enriching = candidate.enriching

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors',
        'hover:border-violet-300 hover:bg-violet-50/30 dark:hover:border-violet-800 dark:hover:bg-violet-950/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        status === 'validated' && 'border-emerald-200/60 bg-emerald-50/30 hover:border-emerald-200/60 hover:bg-emerald-50/30',
        status === 'refused' && 'opacity-50',
        enriching && 'border-violet-300/50 bg-violet-50/20',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium leading-snug">
            {candidate.entreprise || 'Sans nom'}
          </span>
          {enriching ? <EnrichingPill /> : <StatusPill status={status} />}
        </div>
        {main?.nom ? (
          <div className="text-muted-foreground truncate text-[13px]">
            <span className="text-foreground">{main.nom}</span>
            {main.role ? ` — ${main.role}` : ''}
          </div>
        ) : enriching ? (
          <div className="bg-muted h-3.5 w-40 animate-pulse rounded" />
        ) : null}
        {visibleSignaux.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleSignaux.map((s, i) => (
              <Badge
                key={i}
                variant="outline"
                className="border-border bg-transparent font-normal text-[11px] text-muted-foreground"
              >
                {s}
              </Badge>
            ))}
            {extraSignaux > 0 && (
              <span className="text-[11px] text-muted-foreground/80">
                +{extraSignaux}
              </span>
            )}
          </div>
        )}
      </div>
      <ChevronRight className="text-muted-foreground/50 group-hover:text-violet-500 size-4 shrink-0 transition-colors" />
    </div>
  )
}

function StatusPill({ status }: { status: SourcerCandidate['status'] }) {
  if (status === 'validated')
    return (
      <Badge className="shrink-0 gap-0.5 bg-emerald-600 px-1.5 text-[10px] font-medium hover:bg-emerald-600">
        <Check className="size-2.5" />
        Ajouté
      </Badge>
    )
  if (status === 'refused')
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-0.5 px-1.5 text-[10px] text-muted-foreground"
      >
        <X className="size-2.5" />
        Écarté
      </Badge>
    )
  return null
}

function EnrichingPill() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-violet-300 px-1.5 text-[10px] font-normal text-violet-600 dark:border-violet-800 dark:text-violet-300"
    >
      <Loader2 className="size-2.5 animate-spin" />
      Je complète…
    </Badge>
  )
}
