import axios, { type InternalAxiosRequestConfig } from 'axios'

import { clearAuth, emitLogout, getToken } from '@/lib/auth'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Set on the login / forgot-password / reset-password calls so a 401
     *  doesn't trigger a global logout (those calls are themselves the
     *  authentication attempts). */
    _skipAuthRedirect?: boolean
  }
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const skip = error?.config?._skipAuthRedirect
    if (status === 401 && !skip) {
      clearAuth()
      emitLogout()
    }
    return Promise.reject(error)
  },
)

export default api
