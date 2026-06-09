import { apiGet, apiPost } from '@/lib/api'
import type { ActivityKind, Prospect } from '@/lib/prospects'

export type ActionRecord = {
  id: string
  prospectId: string
  kind: ActivityKind
  at: string
  metadata?: Record<string, unknown> | null
}

export type ActionWithProspect = {
  action: ActionRecord
  prospect: Prospect
}

export const listActions = (params?: { since?: string; limit?: number }) =>
  apiGet<ActionRecord[]>('/actions', { params })

export const createAction = (
  prospectId: string,
  input: { kind: ActivityKind; at?: string; metadata?: Record<string, unknown> },
) => apiPost<ActionWithProspect>(`/prospects/${prospectId}/actions`, input)
