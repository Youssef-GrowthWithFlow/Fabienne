import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  AUTH_EVENT,
  clearAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '@/lib/auth'
import { fetchMe, loginApi } from '@/lib/auth-api'
import type { AuthUser } from '@/lib/auth-types'

type AuthStatus = 'initializing' | 'anonymous' | 'authenticated'

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  setUser: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(getStoredUser())
  const [status, setStatus] = useState<AuthStatus>(
    getToken() ? 'initializing' : 'anonymous',
  )

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setStatus('anonymous')
      setUserState(null)
      return
    }
    try {
      const me = await fetchMe()
      setStoredUser(me)
      setUserState(me)
      setStatus('authenticated')
    } catch {
      clearAuth()
      setUserState(null)
      setStatus('anonymous')
    }
  }, [])

  // Initial /me check at boot.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Global logout event fired by the axios 401 interceptor.
  useEffect(() => {
    const handler = () => {
      setUserState(null)
      setStatus('anonymous')
    }
    window.addEventListener(AUTH_EVENT, handler)
    return () => window.removeEventListener(AUTH_EVENT, handler)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password)
    setToken(res.access_token)
    setStoredUser(res.user)
    setUserState(res.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUserState(null)
    setStatus('anonymous')
  }, [])

  const setUser = useCallback((u: AuthUser) => {
    setStoredUser(u)
    setUserState(u)
  }, [])

  const value: AuthContextValue = {
    user,
    status,
    login,
    logout,
    refresh,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
