import axios from 'axios'

export const ADMIN_TOKEN_KEY = 'admin_access_token'

export const adminApi = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
})

adminApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Expired or revoked session: drop the token and send the operator back to login
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err.config?.url?.includes('/admin/auth/login')
    if (err.response?.status === 401 && !isLoginCall && typeof window !== 'undefined') {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export function getApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.message
    if (Array.isArray(message)) return message[0] ?? fallback
    if (typeof message === 'string') return message
  }
  return fallback
}
