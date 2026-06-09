import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import type { EntrepriseRecord, GenerateResponse } from '@/lib/entreprises'

export const listEntreprises = (segmentId?: string) =>
  apiGet<EntrepriseRecord[]>('/entreprises', {
    params: segmentId ? { segment_id: segmentId } : undefined,
  })

export const getEntreprise = (id: string) =>
  apiGet<EntrepriseRecord>(`/entreprises/${id}`)

export const createEntreprise = (
  payload: Omit<EntrepriseRecord, 'id' | 'dateAjout'>,
) => apiPost<EntrepriseRecord>('/entreprises', payload)

export const updateEntreprise = (
  id: string,
  patch: Partial<EntrepriseRecord>,
) => apiPut<EntrepriseRecord>(`/entreprises/${id}`, patch)

export const deleteEntreprise = (id: string) =>
  apiDelete(`/entreprises/${id}`)

export const regenerateEntrepriseFiche = (id: string) =>
  apiPost<EntrepriseRecord>(`/entreprises/${id}/regenerate-fiche`)

export const generateEntreprises = (payload: {
  segmentId: string | null
  count: number
  instruction: string
}) => apiPost<GenerateResponse>('/entreprises/generate', payload)
