import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from '@/lib/api'
import type { AuthUser, LoginResponse } from '@/lib/auth-types'

export const loginApi = (email: string, password: string) =>
  apiPost<LoginResponse>(
    '/auth/login',
    new URLSearchParams({ username: email, password }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      _skipAuthRedirect: true,
    },
  )

export const fetchMe = () => apiGet<AuthUser>('/auth/me')

export const updateMe = (payload: {
  fullName?: string | null
  email?: string
}) =>
  apiPatch<AuthUser>('/auth/me', {
    full_name: payload.fullName,
    email: payload.email,
  })

export const changePassword = (
  currentPassword: string,
  newPassword: string,
) =>
  apiPost<void>('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })

export const forgotPassword = (email: string) =>
  apiPost<void>(
    '/auth/forgot-password',
    { email },
    { _skipAuthRedirect: true },
  )

export const resetPassword = (token: string, password: string) =>
  apiPost<void>(
    '/auth/reset-password',
    { token, password },
    { _skipAuthRedirect: true },
  )

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

export const listUsers = () => apiGet<AuthUser[]>('/users')

export const createUserApi = (payload: UserCreatePayload) =>
  apiPost<AuthUser>('/users', payload)

export const updateUserApi = (id: string, payload: UserUpdatePayload) =>
  apiPatch<AuthUser>(`/users/${id}`, payload)

export const deleteUserApi = (id: string) => apiDelete(`/users/${id}`)

export const adminSetUserPassword = (id: string, password: string) =>
  apiPost<void>(`/users/${id}/set-password`, { password })
