import { Check, Loader2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SourcerCandidate } from '@/hooks/use-sourcer-history'

type Props = {
  candidate: SourcerCandidate
  onOpen: () => void
}

const MAX_SIGNAUX_INLINE = 3

export function CandidateCard({ candidate, onOpen }: Props) {
  const main = candidate.contacts[candidate.mainContactIndex]
  const signaux = candidate.signaux ?? []
  const visibleSignaux = signaux.slice(0, MAX_SIGNAUX_INLINE)
  const extraSignaux = signaux.length - visibleSignaux.length
  const status = candidate.status
  const enriching = candidate.enriching

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full flex-col gap-1.5 rounded-lg border bg-card px-4 py-3 text-left transition-colors',
        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        status === 'validated' && 'border-emerald-200/60 bg-emerald-50/30',
        status === 'refused' && 'opacity-50',
        enriching && 'border-primary/30 bg-primary/[0.02]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-[15px] font-medium leading-snug">
          {candidate.entreprise || 'Sans nom'}
        </span>
        {enriching ? <EnrichingPill /> : <StatusPill status={status} />}
      </div>

      {main?.nom ? (
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-muted-foreground">
          <span className="text-foreground">{main.nom}</span>
          {main.role && (
            <span className="text-muted-foreground">— {main.role}</span>
          )}
        </div>
      ) : enriching ? (
        <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
      ) : null}

      {visibleSignaux.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1">
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
    </button>
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
        Refusé
      </Badge>
    )
  return null
}

function EnrichingPill() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-primary/30 px-1.5 text-[10px] font-normal text-primary"
    >
      <Loader2 className="size-2.5 animate-spin" />
      Enrichissement
    </Badge>
  )
}
