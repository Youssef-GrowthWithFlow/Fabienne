import api from '@/lib/api'
import type { Prospect } from '@/lib/prospects'

export async function listProspects(): Promise<Prospect[]> {
  const { data } = await api.get<Prospect[]>('/prospects')
  return data
}

export async function getProspect(id: string): Promise<Prospect> {
  const { data } = await api.get<Prospect>(`/prospects/${id}`)
  return data
}

export async function createProspect(prospect: Prospect): Promise<Prospect> {
  const { data } = await api.post<Prospect>('/prospects', prospect)
  return data
}

export async function updateProspect(
  id: string,
  prospect: Prospect,
): Promise<Prospect> {
  const { data } = await api.put<Prospect>(`/prospects/${id}`, prospect)
  return data
}

export async function deleteProspect(id: string): Promise<void> {
  await api.delete(`/prospects/${id}`)
}
