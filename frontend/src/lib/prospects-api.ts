import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import type { Prospect } from '@/lib/prospects'

export const listProspects = () => apiGet<Prospect[]>('/prospects')

export const getProspect = (id: string) => apiGet<Prospect>(`/prospects/${id}`)

export const createProspect = (prospect: Prospect) =>
  apiPost<Prospect>('/prospects', prospect)

export const updateProspect = (id: string, prospect: Prospect) =>
  apiPut<Prospect>(`/prospects/${id}`, prospect)

export const deleteProspect = (id: string) => apiDelete(`/prospects/${id}`)
