import api from '@/lib/api'
import type { AuthUser, LoginResponse } from '@/lib/auth-types'

export async function loginApi(
  email: string,
  password: string,
): Promise<LoginResponse> {
  // OAuth2PasswordRequestForm expects form-urlencoded with `username` field.
  const body = new URLSearchParams({ username: email, password })
  const { data } = await api.post<LoginResponse>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // Don't surface a 401 here as a global logout — it's the login attempt.
    _skipAuthRedirect: true,
  } as Parameters<typeof api.post>[2])
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me')
  return data
}

export async function updateMe(payload: {
  fullName?: string | null
  email?: string
}): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>('/auth/me', {
    full_name: payload.fullName,
    email: payload.email,
  })
  return data
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post(
    '/auth/forgot-password',
    { email },
    { _skipAuthRedirect: true } as Parameters<typeof api.post>[2],
  )
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await api.post(
    '/auth/reset-password',
    { token, password },
    { _skipAuthRedirect: true } as Parameters<typeof api.post>[2],
  )
}

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------

export type UserCreatePayload = {
  email: string
  full_name?: string
  password: string
  is_admin: boolean
}

export type UserUpdatePayload = {
  full_name?: string
  is_active?: boolean
  is_admin?: boolean
}

export async function listUsers(): Promise<AuthUser[]> {
  const { data } = await api.get<AuthUser[]>('/users')
  return data
}

export async function createUserApi(payload: UserCreatePayload): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/users', payload)
  return data
}

export async function updateUserApi(
  id: string,
  payload: UserUpdatePayload,
): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>(`/users/${id}`, payload)
  return data
}

export async function deleteUserApi(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function adminResetUserPassword(
  id: string,
): Promise<{ reset_url: string }> {
  const { data } = await api.post<{ reset_url: string }>(
    `/users/${id}/reset-password`,
  )
  return data
}
