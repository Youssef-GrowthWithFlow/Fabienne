import api from '@/lib/api'
import type { Comment } from '@/lib/prospects'

export async function listComments(prospectId: string): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(
    `/prospects/${prospectId}/comments`,
  )
  return data
}

export async function createComment(
  prospectId: string,
  input: { date: string; texte: string },
): Promise<Comment> {
  const { data } = await api.post<Comment>(
    `/prospects/${prospectId}/comments`,
    input,
  )
  return data
}

export async function updateComment(
  prospectId: string,
  commentId: string,
  patch: { texte?: string; date?: string },
): Promise<Comment> {
  const { data } = await api.put<Comment>(
    `/prospects/${prospectId}/comments/${commentId}`,
    patch,
  )
  return data
}

export async function deleteComment(
  prospectId: string,
  commentId: string,
): Promise<void> {
  await api.delete(`/prospects/${prospectId}/comments/${commentId}`)
}
