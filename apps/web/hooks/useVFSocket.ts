'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export interface RoundOdds {
  '1x2': { '1': number; X: number; '2': number }
  btts: { yes: number; no: number }
  over_under: { over: number; under: number }
}

export interface VFRound {
  id: string
  league: 'A' | 'B'
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  odds: RoundOdds
  status: string
  cycleAt: string
  rngSeedHash: string
}

export interface VFResult {
  id: string
  league: 'A' | 'B'
  homeTeam: { name: string }
  awayTeam: { name: string }
  homeScore: number
  awayScore: number
  halfTimeHome: number
  halfTimeAway: number
  cycleAt: string
}

type RoundsDispatch = React.Dispatch<React.SetStateAction<VFRound[]>>
type ResultsDispatch = React.Dispatch<React.SetStateAction<VFResult[]>>

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'

export function useVFSocket(
  setRounds: RoundsDispatch,
  setResults: ResultsDispatch,
) {
  const socketRef = useRef<Socket | null>(null)

  const handleUpcoming = useCallback((payload: { round: VFRound }) => {
    setRounds((prev) => {
      const exists = prev.some((r) => r.id === payload.round.id)
      if (exists) return prev
      return [...prev, payload.round]
    })
  }, [setRounds])

  const handleBettingOpen = useCallback((payload: { round: VFRound }) => {
    setRounds((prev) =>
      prev.map((r) => r.id === payload.round.id ? { ...r, ...payload.round } : r)
    )
  }, [setRounds])

  const handleResult = useCallback((payload: {
    roundId: string
    homeTeam: string
    awayTeam: string
    homeScore: number
    awayScore: number
    halfTimeHome: number
    halfTimeAway: number
  }) => {
    // Move round from active to results
    setRounds((prev) => prev.filter((r) => r.id !== payload.roundId))
    setResults((prev) => {
      const newResult: VFResult = {
        id: payload.roundId,
        league: 'A', // will be overridden by the actual data
        homeTeam: { name: payload.homeTeam },
        awayTeam: { name: payload.awayTeam },
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        halfTimeHome: payload.halfTimeHome,
        halfTimeAway: payload.halfTimeAway,
        cycleAt: new Date().toISOString(),
      }
      return [newResult, ...prev].slice(0, 10)
    })
  }, [setRounds, setResults])

  useEffect(() => {
    const socket = io(WS_URL, {
      query: { league: 'all' },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on('vf:upcoming',      handleUpcoming)
    socket.on('vf:betting_open',  handleBettingOpen)
    socket.on('vf:result',        handleResult)

    return () => {
      socket.off('vf:upcoming',     handleUpcoming)
      socket.off('vf:betting_open', handleBettingOpen)
      socket.off('vf:result',       handleResult)
      socket.disconnect()
      socketRef.current = null
    }
  }, [handleUpcoming, handleBettingOpen, handleResult])
}
