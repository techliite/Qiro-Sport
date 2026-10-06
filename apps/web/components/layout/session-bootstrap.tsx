'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useWalletStore } from '@/store/wallet.store'

interface RefreshResponse {
  user?: { id: string; phone: string; username: string }
  accessToken: string | null
}

export function SessionBootstrap() {
  const setAuth    = useAuthStore((s) => s.setAuth)
  const clearAuth  = useAuthStore((s) => s.clearAuth)
  const setBalance = useWalletStore((s) => s.setBalance)

  useEffect(() => {
    api.post<RefreshResponse>('/auth/refresh')
      .then((r) => {
        if (!r.data.accessToken || !r.data.user) {
          clearAuth()
          window.location.replace('/login')
          return null
        }
        setAuth(r.data.user, r.data.accessToken)
        return api.get<{ balanceKobo: number }>('/wallet/balance')
      })
      .then((r) => { if (r) setBalance(r.data.balanceKobo) })
      .catch((err: { response?: { status?: number } }) => {
        if (err.response?.status === 401) {
          clearAuth()
          window.location.replace('/login')
        }
      })
  }, [clearAuth, setAuth, setBalance])

  return null
}
