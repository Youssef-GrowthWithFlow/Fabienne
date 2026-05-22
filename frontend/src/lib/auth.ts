/**
 * Token + user persistence helpers. Storage is plain localStorage —
 * everything goes through these helpers so swapping to httpOnly cookies
 * later is a one-file change.
 */
import type { AuthUser } from '@/lib/auth-types'

const TOKEN_KEY = 'fabienne_token'
const USER_KEY = 'fabienne_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** Custom event the axios 401 handler fires; the auth context listens for it
 * and downgrades the current session to `anonymous`. */
export const AUTH_EVENT = 'fabienne:auth-logout'

export function emitLogout(): void {
  window.dispatchEvent(new Event(AUTH_EVENT))
}
