import { Check, Loader2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SourcerCandidate } from '@/hooks/use-sourcer-history'

type Props = {
  candidate: SourcerCandidate
  onOpen: () => void
  /** Quick actions shown on pending cards — the same as in the detail sheet. */
  onValidate?: () => void
  onRefuse?: () => void
  busy?: boolean
}

const MAX_SIGNAUX_INLINE = 3

export function CandidateCard({
  candidate,
  onOpen,
  onValidate,
  onRefuse,
  busy,
}: Props) {
  const main = candidate.contacts[candidate.mainContactIndex]
  const signaux = candidate.signaux ?? []
  const visibleSignaux = signaux.slice(0, MAX_SIGNAUX_INLINE)
  const extraSignaux = signaux.length - visibleSignaux.length
  const status = candidate.status
  const enriching = candidate.enriching
  const locked = enriching || candidate.persisted === false
  const showActions =
    status === 'pending' && (onValidate || onRefuse) && !locked

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
        'group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border bg-card px-4 py-3 text-left transition-colors',
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

      {showActions ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              onValidate?.()
            }}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Ajouter à mes contacts
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              onRefuse?.()
            }}
            className="text-muted-foreground gap-1.5"
          >
            <X className="size-3.5" />
            Non merci
          </Button>
          <span className="text-muted-foreground ml-auto text-[11px] max-sm:hidden">
            Clique la carte pour tout voir
          </span>
        </div>
      ) : null}
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
        Refusé
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
