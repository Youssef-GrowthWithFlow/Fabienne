import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { FieldSource } from '@/lib/entreprises'

const LABELS: Record<FieldSource, string> = {
  api_gouv: 'Source — API Entreprise (INSEE)',
  ai_grounding: 'Source — Recherche IA (Google + Gemini)',
  ai_grounding_verified: 'Source — IA confirmée par source publique (Google + Gemini)',
  finess: 'Source — FINESS (data.gouv.fr)',
  ordre: 'Source — Annuaire officiel de l\'Ordre National des Pharmaciens',
  google_places: 'Source — Google Places (téléphone, site web, note, GPS, Maps)',
  dropcontact: 'Source — DropContact (email vérifié, téléphone, LinkedIn, poste)',
  manual: 'Source — Saisie manuelle',
  gemini: 'Source — IA (Gemini)',
}

type Props = {
  source: FieldSource | string | null | undefined
  children: React.ReactNode
  className?: string
}

/**
 * Wraps a piece of content so hovering it shows the data's origin. Replaces
 * the visible SourceBadge: provenance is now invisible by default, surfaced
 * on hover, but the underlying styling hints (border-bottom dotted) tell
 * the user a tooltip is available.
 */
export function WithSourceTooltip({ source, children, className }: Props) {
  const label = source ? LABELS[source as FieldSource] : null
  if (!label) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              'cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2',
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
