import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { FieldSource } from '@/lib/entreprises'

type Props = {
  source: FieldSource | string | undefined | null
  className?: string
}

const META: Record<
  FieldSource,
  { label: string; full: string; tone: string }
> = {
  api_gouv: {
    label: 'INSEE',
    full: 'Donnée vérifiée — API Entreprise (INSEE)',
    tone:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  },
  ai_grounding: {
    label: 'IA',
    full: 'Recherche IA (Google + Gemini)',
    tone:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
  },
  ai_grounding_verified: {
    label: 'IA✓',
    full: 'Recherche IA confirmée par source publique (Google + Gemini)',
    tone:
      'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-900 dark:text-violet-200',
  },
  finess: {
    label: 'FINESS',
    full: 'Référentiel FINESS (data.gouv.fr)',
    tone:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  },
  ordre: {
    label: 'CNOP',
    full: "Annuaire officiel — Ordre National des Pharmaciens",
    tone:
      'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  google_places: {
    label: 'Google',
    full: 'Google Places (téléphone, site web, note, avis, GPS, lien Maps)',
    tone:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  dropcontact: {
    label: 'DropContact',
    full: 'DropContact (email vérifié, téléphone, LinkedIn, intitulé de poste)',
    tone:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  },
  manual: {
    label: 'Manuel',
    full: 'Saisie manuelle',
    tone:
      'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  },
  gemini: {
    label: 'IA',
    full: 'Recherche IA (Gemini)',
    tone:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
  },
}

export function SourceBadge({ source, className }: Props) {
  if (!source) return null
  const meta = META[source as FieldSource]
  if (!meta) return null
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn(
              'h-4 cursor-help px-1.5 text-[10px] font-medium leading-none',
              meta.tone,
              className,
            )}
          />
        }
      >
        {meta.label}
      </TooltipTrigger>
      <TooltipContent>{meta.full}</TooltipContent>
    </Tooltip>
  )
}
