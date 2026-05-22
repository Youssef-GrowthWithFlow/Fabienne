import api from '@/lib/api'
import type { SegmentBrief } from '@/lib/segments'

export type SegmentRecord = { id: string } & SegmentBrief

export async function listSegments(): Promise<SegmentRecord[]> {
  const { data } = await api.get<SegmentRecord[]>('/segments')
  return data
}

export async function createSegment(
  brief: SegmentBrief,
): Promise<SegmentRecord> {
  const { data } = await api.post<SegmentRecord>('/segments', brief)
  return data
}

export async function updateSegment(
  id: string,
  brief: SegmentBrief,
): Promise<SegmentRecord> {
  const { data } = await api.put<SegmentRecord>(`/segments/${id}`, brief)
  return data
}

export async function deleteSegment(id: string): Promise<void> {
  await api.delete(`/segments/${id}`)
}
