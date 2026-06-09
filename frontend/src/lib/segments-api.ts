import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import type { SegmentBrief } from '@/lib/segments'

export type SegmentRecord = { id: string } & SegmentBrief

export const listSegments = () => apiGet<SegmentRecord[]>('/segments')

export const createSegment = (brief: SegmentBrief) =>
  apiPost<SegmentRecord>('/segments', brief)

export const updateSegment = (id: string, brief: SegmentBrief) =>
  apiPut<SegmentRecord>(`/segments/${id}`, brief)

export const deleteSegment = (id: string) => apiDelete(`/segments/${id}`)
