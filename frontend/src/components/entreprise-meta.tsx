import {
  Briefcase,
  ExternalLink,
  Globe,
  MapPin,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { WithSourceTooltip } from '@/components/with-source-tooltip'
import type { FieldSource } from '@/lib/entreprises'

type MetaFields = {
  ville?: string
  secteur?: string
  taille?: string
  effectif?: string | null
  siret?: string | null
  siteWeb?: string
  fieldSources?: Record<string, FieldSource> | null
}

type Props = {
  entreprise: MetaFields
  /** Hide site link (e.g. on cards where site appears elsewhere). */
  hideSite?: boolean
}

export function EntrepriseMeta({ entreprise: e, hideSite }: Props) {
  const sources = e.fieldSources
  const items: { key: string; icon: LucideIcon; node: React.ReactNode }[] = []

  if (e.ville) {
    items.push({
      key: 'ville',
      icon: MapPin,
      node: (
        <WithSourceTooltip source={sources?.ville}>{e.ville}</WithSourceTooltip>
      ),
    })
  }
  if (e.secteur) {
    items.push({
      key: 'secteur',
      icon: Briefcase,
      node: (
        <WithSourceTooltip source={sources?.secteur} className="truncate">
          {e.secteur}
        </WithSourceTooltip>
      ),
    })
  }
  if (e.effectif || e.taille) {
    items.push({
      key: 'taille',
      icon: Users,
      node: (
        <WithSourceTooltip source={sources?.effectif ?? sources?.taille}>
          {e.effectif || e.taille}
        </WithSourceTooltip>
      ),
    })
  }
  if (e.siteWeb && !hideSite) {
    items.push({
      key: 'site',
      icon: Globe,
      node: (
        <a
          href={e.siteWeb}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={(ev) => ev.stopPropagation()}
        >
          Site
          <ExternalLink className="size-3" />
        </a>
      ),
    })
  }

  if (items.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5">
          <it.icon className="size-3 shrink-0" />
          {it.node}
        </span>
      ))}
    </div>
  )
}
