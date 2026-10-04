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
  const setBalance = useWalletStore((s) => s.setBalance)

  useEffect(() => {
    api.post<RefreshResponse>('/auth/refresh')
      .then((r) => {
        // No refresh cookie → no session to restore. Leave any existing token alone
        // (storing null here used to save the string "null" and log the user out).
        if (!r.data.accessToken || !r.data.user) return null
        setAuth(r.data.user, r.data.accessToken)
        return api.get<{ balanceKobo: number }>('/wallet/balance')
      })
      .then((r) => { if (r) setBalance(r.data.balanceKobo) })
      .catch(() => null)
  }, [setAuth, setBalance])

  return null
}
