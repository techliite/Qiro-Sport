'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useWalletStore } from '@/store/wallet.store'
import { useToastStore } from '@/store/toast.store'
import { formatNaira } from '@qiro/ui'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'

interface BetSettledPayload {
  betId: string
  won: boolean
  payoutKobo: number
}

export function useUserSocket(userId: string | undefined) {
  const setBalance = useWalletStore((s) => s.setBalance)
  const pushToast  = useToastStore((s) => s.push)
  const socketRef  = useRef<Socket | null>(null)

  useEffect(() => {
    if (!userId) return

    const socket = io(WS_URL, {
      query: { userId },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    })

    socketRef.current = socket

    socket.on('user:balance', (payload: { balanceKobo: number }) => {
      setBalance(payload.balanceKobo)
    })

    socket.on('user:bet_settled', (payload: BetSettledPayload) => {
      pushToast({
        type: payload.won ? 'win' : 'loss',
        title: payload.won ? 'You won!' : 'Bet settled',
        body: payload.won
          ? `Payout: ${formatNaira(payload.payoutKobo)}`
          : 'Better luck next time',
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, setBalance, pushToast])
}
