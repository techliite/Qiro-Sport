import axios from 'axios'

export const api = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
})

// Attach access token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401 — full implementation in Phase 0
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // TODO Phase 0: call /auth/refresh, retry original request
      localStorage.removeItem('access_token')
      window.location.href = '/(auth)/login'
    }
    return Promise.reject(err)
  },
)
