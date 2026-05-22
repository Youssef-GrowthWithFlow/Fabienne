import api from '@/lib/api'
import type { Prospect } from '@/lib/prospects'
import type {
  BulkEntrepriseItem,
  EntrepriseRecord,
  GenerateResponse,
} from '@/lib/entreprises'

export async function listEntreprises(
  segmentId?: string,
): Promise<EntrepriseRecord[]> {
  const { data } = await api.get<EntrepriseRecord[]>('/entreprises', {
    params: segmentId ? { segment_id: segmentId } : undefined,
  })
  return data
}

export async function getEntreprise(id: string): Promise<EntrepriseRecord> {
  const { data } = await api.get<EntrepriseRecord>(`/entreprises/${id}`)
  return data
}

export async function createEntreprise(
  payload: Omit<EntrepriseRecord, 'id' | 'dateAjout'>,
): Promise<EntrepriseRecord> {
  const { data } = await api.post<EntrepriseRecord>('/entreprises', payload)
  return data
}

export async function updateEntreprise(
  id: string,
  patch: Partial<EntrepriseRecord>,
): Promise<EntrepriseRecord> {
  const { data } = await api.put<EntrepriseRecord>(`/entreprises/${id}`, patch)
  return data
}

export async function deleteEntreprise(id: string): Promise<void> {
  await api.delete(`/entreprises/${id}`)
}

/** Trigger backend Gemini regeneration of `fiche_client` for an entreprise.
 *  Idempotent: the response carries the fresh entreprise with the new HTML
 *  already persisted. Takes ~5–8 s due to thinking + Google Search. */
export async function regenerateEntrepriseFiche(
  id: string,
): Promise<EntrepriseRecord> {
  const { data } = await api.post<EntrepriseRecord>(
    `/agents/entreprises/${id}/regenerate-fiche`,
  )
  return data
}

export async function generateEntreprises(payload: {
  segmentId: string | null
  count: number
  instruction: string
}): Promise<GenerateResponse> {
  const { data } = await api.post<GenerateResponse>(
    '/entreprises/generate',
    payload,
  )
  return data
}

export async function bulkCreateEntreprises(payload: {
  segmentId: string | null
  entreprises: BulkEntrepriseItem[]
}): Promise<{ entreprises: EntrepriseRecord[]; prospects: Prospect[] }> {
  const { data } = await api.post<{
    entreprises: EntrepriseRecord[]
    prospects: Prospect[]
  }>('/entreprises/bulk', payload)
  return data
}
