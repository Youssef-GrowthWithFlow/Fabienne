import api from '@/lib/api'
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

export async function listActions(params?: {
  since?: string
  limit?: number
}): Promise<ActionRecord[]> {
  const { data } = await api.get<ActionRecord[]>('/actions', { params })
  return data
}

export async function createAction(
  prospectId: string,
  input: { kind: ActivityKind; at?: string; metadata?: Record<string, unknown> },
): Promise<ActionWithProspect> {
  const { data } = await api.post<ActionWithProspect>(
    `/prospects/${prospectId}/actions`,
    input,
  )
  return data
}
