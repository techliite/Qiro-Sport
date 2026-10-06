import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth.store'

export const api = axios.create({
  // Same-origin by default — next.config.ts proxies /api/v1 to the API (see API_PROXY_TARGET)
  baseURL: process.env['NEXT_PUBLIC_API_URL'] || '/api/v1',
  withCredentials: true, // sends httpOnly refresh cookie
})

// A refresh 401 must reject the current attempt instead of entering this interceptor again.
const refreshApi = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] || '/api/v1',
  withCredentials: true,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

function clearSession() {
  if (typeof window === 'undefined') return
  useAuthStore.getState().clearAuth()
  localStorage.removeItem('access_token')
  window.location.replace('/login')
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config as InternalAxiosRequestConfig & { _retry?: boolean }

    const requestUrl = originalRequest?.url ?? ''
    const isAuthRequest = /\/auth\/(login|register|verify-otp|otp\/resend|refresh)/.test(requestUrl)
    if (err.response?.status !== 401 || originalRequest?._retry || isAuthRequest) {
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return api(originalRequest)
        })
        .catch((e) => Promise.reject(e))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await refreshApi.post<{ accessToken: string | null }>('/auth/refresh')

      if (!data.accessToken) {
        // Refresh cookie expired — hard logout
        clearSession()
        return Promise.reject(err)
      }

      localStorage.setItem('access_token', data.accessToken)
      processQueue(null, data.accessToken)

      originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearSession()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
