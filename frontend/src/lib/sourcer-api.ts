import api from '@/lib/api'
import { getToken } from '@/lib/auth'
import type {
  EntrepriseRecord,
  ProposedEntreprise,
} from '@/lib/entreprises'
import type { Prospect } from '@/lib/prospects'

export type SourcedStatus = 'pending' | 'validated' | 'refused'

export type SourcedCandidate = {
  id: string
  status: SourcedStatus
  segmentId: string | null
  instruction: string
  payload: ProposedEntreprise
  mainContactIndex: number
  entrepriseId: string | null
  prospectId: string | null
  createdAt: string
}

export type SourcerRunRequest = {
  segmentId: string | null
  count: number
  instruction: string
}

export type SourcerRunResponse = {
  candidates: SourcedCandidate[]
  searchQueries: string[]
}

export async function runSourcing(
  payload: SourcerRunRequest,
): Promise<SourcerRunResponse> {
  const { data } = await api.post<SourcerRunResponse>('/sourcer/run', payload)
  return data
}

// ---------------------------------------------------------------------------
// SSE streaming version — emits phase events while the sourcing runs.
// ---------------------------------------------------------------------------

export type SourcerPhase =
  | 'loading_history'
  | 'finess_shortlist'
  | 'gemini_sourcing'
  | 'enriching'
  | 'done'

export type SourcerPhaseEvent = {
  type: 'phase'
  phase: SourcerPhase
  message: string
  detail?: string
  current?: number
  total?: number
  count?: number
}

/** A new candidate fresh out of Gemini, before any enrichment. */
export type SourcerCandidateRawEvent = {
  type: 'phase'
  phase: 'candidate_raw'
  temp_id: string
  data: ProposedEntreprise
}

/** Enrichment finished for a candidate — replaces its raw card in the UI. */
export type SourcerCandidateEnrichedEvent = {
  type: 'phase'
  phase: 'candidate_enriched'
  temp_id: string
  current: number
  total: number
  data: ProposedEntreprise
}

/** Post-enrichment SIRET dedup eliminated this candidate; remove from UI. */
export type SourcerCandidateDroppedEvent = {
  type: 'phase'
  phase: 'candidate_dropped'
  temp_id: string
}

export type SourcerResultEvent = {
  type: 'result'
  data: SourcerRunResponse
}

export type SourcerErrorEvent = {
  type: 'error'
  message: string
}

export type SourcerStreamEvent =
  | SourcerPhaseEvent
  | SourcerCandidateRawEvent
  | SourcerCandidateEnrichedEvent
  | SourcerCandidateDroppedEvent
  | SourcerResultEvent
  | SourcerErrorEvent

/**
 * Run sourcing with live per-phase updates. ``onEvent`` is called as each
 * SSE frame arrives (phase / result / error). The promise resolves with the
 * final ``SourcerRunResponse`` or rejects with the streamed error message.
 */
export async function runSourcingStream(
  payload: SourcerRunRequest,
  onEvent: (event: SourcerStreamEvent) => void,
): Promise<SourcerRunResponse> {
  const token = getToken()
  const resp = await fetch('/api/v1/sourcer/run/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok || !resp.body) {
    throw new Error(`HTTP ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalResult: SourcerRunResponse | null = null
  let errorMsg: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line (\n\n).
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const json = line.slice(6).trim()
        if (!json) continue
        try {
          const event = JSON.parse(json) as SourcerStreamEvent
          onEvent(event)
          if (event.type === 'result') finalResult = event.data
          if (event.type === 'error') errorMsg = event.message
        } catch {
          // ignore malformed frames
        }
      }
    }
  }

  if (errorMsg) throw new Error(errorMsg)
  if (!finalResult) throw new Error('Flux interrompu sans résultat.')
  return finalResult
}

export async function listSourcedCandidates(
  status?: SourcedStatus,
): Promise<SourcedCandidate[]> {
  const { data } = await api.get<SourcedCandidate[]>('/sourcer/candidates', {
    params: status ? { status_filter: status } : undefined,
  })
  return data
}

export async function updateSourcedCandidate(
  id: string,
  patch: { mainContactIndex?: number },
): Promise<SourcedCandidate> {
  const { data } = await api.patch<SourcedCandidate>(
    `/sourcer/candidates/${id}`,
    patch,
  )
  return data
}

export async function refuseSourcedCandidate(
  id: string,
): Promise<SourcedCandidate> {
  const { data } = await api.post<SourcedCandidate>(
    `/sourcer/candidates/${id}/refuse`,
  )
  return data
}

export async function validateSourcedCandidate(id: string): Promise<{
  candidate: SourcedCandidate
  entreprise: EntrepriseRecord | null
  prospect: Prospect | null
}> {
  const { data } = await api.post<{
    candidate: SourcedCandidate
    entreprise: EntrepriseRecord | null
    prospect: Prospect | null
  }>(`/sourcer/candidates/${id}/validate`)
  return data
}
