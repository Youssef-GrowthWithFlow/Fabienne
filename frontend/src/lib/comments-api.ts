import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import type { Comment } from '@/lib/prospects'

export const listComments = (prospectId: string) =>
  apiGet<Comment[]>(`/prospects/${prospectId}/comments`)

export const createComment = (
  prospectId: string,
  input: { date: string; texte: string },
) => apiPost<Comment>(`/prospects/${prospectId}/comments`, input)

export const updateComment = (
  prospectId: string,
  commentId: string,
  patch: { texte?: string; date?: string },
) => apiPut<Comment>(`/prospects/${prospectId}/comments/${commentId}`, patch)

export const deleteComment = (prospectId: string, commentId: string) =>
  apiDelete(`/prospects/${prospectId}/comments/${commentId}`)
