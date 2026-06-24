'use client'

import { create } from 'zustand'

interface AuthUser {
  id: string
  phone: string
  username: string
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, accessToken: string) => void
  clearAuth: () => void
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken)
    }
    set({ user, accessToken, isAuthenticated: true })
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
    }
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))
