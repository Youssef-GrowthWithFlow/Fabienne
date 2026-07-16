import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'

import { GROUP_COLORS } from '@/lib/group-colors'
import { countByGroup, type Prospect } from '@/lib/prospects'
import { cn } from '@/lib/utils'

const GROUP_LABELS: [key: string, label: string][] = [
  ['a-contacter', 'À contacter'],
  ['en-cours', 'En cours'],
  ['clients', 'Clients'],
  ['refus', 'Refus'],
]

/**
 * One-glance pipeline: a proportional colored bar + legend with counts.
 * Clicking it goes to the contacts list.
 */
export function PipelineBar({ prospects }: { prospects: Prospect[] }) {
  const counts = useMemo(() => countByGroup(prospects), [prospects])
  const total = prospects.length

  if (total === 0) return null

  return (
    <NavLink
      to="/contacts"
      className="hover:bg-muted/30 block rounded-xl border p-4 transition-colors"
    >
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {GROUP_LABELS.map(([key]) => {
          const n = counts[key as keyof typeof counts]
          if (n === 0) return null
          return (
            <div
              key={key}
              className={cn('h-full rounded-sm', GROUP_COLORS[key].bar)}
              style={{ width: `${(n / total) * 100}%` }}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {GROUP_LABELS.map(([key, label]) => {
          const n = counts[key as keyof typeof counts]
          return (
            <span key={key} className="flex items-center gap-1.5 text-sm">
              <span className={cn('size-2 rounded-full', GROUP_COLORS[key].dot)} />
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </span>
          )
        })}
      </div>
    </NavLink>
  )
}
