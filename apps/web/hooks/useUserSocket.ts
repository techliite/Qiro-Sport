'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useWalletStore } from '@/store/wallet.store'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'

export function useUserSocket(userId: string | undefined) {
  const setBalance = useWalletStore((s) => s.setBalance)
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

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, setBalance])
}
