'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Zap, Clock, Trophy, X, Minus, Plus, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { io } from 'socket.io-client'
import { api } from '@/lib/api'
import { useWalletStore } from '@/store/wallet.store'
import { cn } from '@qiro/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Horse {
  id: number
  name: string
  jockey: string
  form: number[]
  currentRating: number
  winOdds: number
  placeOdds: number
}

interface Race {
  id: string
  raceNumber: number
  status: string
  cycleAt: string
  seedHash: string
  horses: Horse[]
}

interface RaceResult {
  id: string
  raceNumber: number
  cycleAt: string
  finishingOrder: { id: number; name: string }[]
  seed: string | null
}

interface Selection {
  horseId: number
  horseName: string
  market: 'win' | 'place'
  odds: number
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(cycleAt: string) {
  const [ms, setMs] = useState(() => new Date(cycleAt).getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => setMs(new Date(cycleAt).getTime() - Date.now()), 1000)
    return () => clearInterval(t)
  }, [cycleAt])
  const secs = Math.max(0, Math.floor(ms / 1000))
  return { mins: Math.floor(secs / 60), secs: secs % 60, isClosing: ms < 15_000, isExpired: ms <= 0 }
}

// ─── Form Dots ────────────────────────────────────────────────────────────────

function FormDots({ form }: { form: number[] }) {
  return (
    <div className="flex gap-0.5">
      {form.slice(-5).map((pos, i) => (
        <span key={i} className={cn('w-3.5 h-3.5 rounded-sm text-[8px] font-black flex items-center justify-center', pos === 1 ? 'bg-[#00C48C]/20 text-[#00C48C]' : pos === 2 ? 'bg-[#0066FF]/20 text-[#0066FF]' : pos <= 3 ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-[#1A2B4A] text-[#4D6B9A]')}>
          {pos}
        </span>
      ))}
    </div>
  )
}

// ─── Horse Row ────────────────────────────────────────────────────────────────

function HorseRow({ horse, sel, onSelect, disabled }: {
  horse: Horse
  sel: Selection | undefined
  onSelect: (market: 'win' | 'place') => void
  disabled: boolean
}) {
  const winSel   = sel?.market === 'win'
  const placeSel = sel?.market === 'place'

  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 border-b border-[#0F1B3D] last:border-0 transition-colors', (winSel || placeSel) ? 'bg-[#0066FF]/5' : 'hover:bg-[#081226]/50')}>
      {/* Number */}
      <div className="w-6 h-6 rounded-full bg-[#0F1B3D] border border-[#1A2B4A] flex items-center justify-center shrink-0">
        <span className="text-[9px] font-black text-[#4D6B9A]">{horse.id}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#E6F1FF] truncate">{horse.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[#4D6B9A]">J: {horse.jockey}</span>
          <FormDots form={horse.form} />
        </div>
      </div>

      {/* Odds buttons */}
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => !disabled && onSelect('win')}
          disabled={disabled}
          className={cn('flex flex-col items-center w-14 py-1.5 rounded-lg border text-[10px] transition-all', winSel ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-[0_0_10px_rgba(0,102,255,0.4)]' : 'bg-[#0F1B3D] border-[#1A2B4A] text-[#4D6B9A] hover:border-[#0066FF]/40 hover:text-[#E6F1FF]', disabled && 'opacity-40 cursor-not-allowed')}
        >
          <span className="font-medium">Win</span>
          <span className="font-bold text-sm">{horse.winOdds.toFixed(2)}</span>
        </button>
        <button
          onClick={() => !disabled && onSelect('place')}
          disabled={disabled}
          className={cn('flex flex-col items-center w-14 py-1.5 rounded-lg border text-[10px] transition-all', placeSel ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-[0_0_10px_rgba(0,102,255,0.4)]' : 'bg-[#0F1B3D] border-[#1A2B4A] text-[#4D6B9A] hover:border-[#0066FF]/40 hover:text-[#E6F1FF]', disabled && 'opacity-40 cursor-not-allowed')}
        >
          <span className="font-medium">Place</span>
          <span className="font-bold text-sm">{horse.placeOdds.toFixed(2)}</span>
        </button>
      </div>
    </div>
  )
}

// ─── Bet Slip ─────────────────────────────────────────────────────────────────

function BetSlip({ race, selections, onRemove, onClear, onSuccess }: {
  race: Race
  selections: Selection[]
  onRemove: (horseId: number) => void
  onClear: () => void
  onSuccess: () => void
}) {
  const balance    = useWalletStore((s) => s.balanceKobo)
  const setBalance = useWalletStore((s) => s.setBalance)
  const [stakeInput, setStakeInput] = useState('500')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)

  const stakeKobo = Math.floor(Number(stakeInput) * 100)
  const perSelKobo = Math.floor(stakeKobo / selections.length)
  const totalReturn = selections.reduce((acc, s) => acc + Math.floor(perSelKobo * s.odds), 0)

  const handlePlace = async () => {
    if (stakeKobo < 10_000) { setError('Min stake ₦100'); return }
    if (stakeKobo > balance) { setError('Insufficient balance'); return }
    setLoading(true); setError('')

    try {
      for (const sel of selections) {
        await api.post('/virtual/horse-racing/bet', {
          roundId: race.id, horseId: sel.horseId,
          market: sel.market, stakeKobo: perSelKobo,
        })
      }
      setBalance(balance - stakeKobo)
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onSuccess() }, 2000)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to place bet')
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full bg-[#00C48C]/10 flex items-center justify-center">
          <CheckCircle2 className="text-[#00C48C]" size={28} />
        </div>
        <p className="font-bold text-[#E6F1FF]">Bets Placed!</p>
        <p className="text-sm text-[#4D6B9A]">Good luck at the races!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        {selections.map((s) => (
          <div key={s.horseId} className="flex items-center gap-2 bg-[#081226] rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#E6F1FF]">{s.horseName}</p>
              <p className="text-[10px] text-[#4D6B9A] capitalize">{s.market} · @{s.odds.toFixed(2)}</p>
            </div>
            <button onClick={() => onRemove(s.horseId)} className="text-[#4D6B9A] hover:text-[#EF4444] transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-[#4D6B9A] uppercase tracking-wider">
          Total Stake (₦){selections.length > 1 && ` · ₦${(perSelKobo / 100).toFixed(0)} per bet`}
        </label>
        <div className="flex items-center gap-2">
          <button onClick={() => setStakeInput((v) => String(Math.max(100, (parseFloat(v)||0) - 100)))} className="w-9 h-9 rounded-xl bg-[#081226] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"><Minus size={14} /></button>
          <input type="number" value={stakeInput} onChange={(e) => setStakeInput(e.target.value)} className="flex-1 bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 py-2 text-center text-[#E6F1FF] text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all" />
          <button onClick={() => setStakeInput((v) => String((parseFloat(v)||0) + 100))} className="w-9 h-9 rounded-xl bg-[#081226] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"><Plus size={14} /></button>
        </div>
        <div className="flex gap-1.5">
          {[500, 1000, 2000, 5000].map((n) => (
            <button key={n} onClick={() => setStakeInput(String(n))} className="flex-1 py-1 rounded-lg bg-[#081226] border border-[#1A2B4A] text-[10px] font-semibold text-[#4D6B9A] hover:border-[#0066FF]/40 hover:text-[#E6F1FF] transition-all">₦{n.toLocaleString()}</button>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-xs px-0.5">
        <span className="text-[#4D6B9A]">Est. Return</span>
        <span className="font-bold text-[#00C48C]">₦{(totalReturn / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
      </div>

      {error && <div className="flex items-center gap-2 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2"><AlertCircle size={13} />{error}</div>}

      <div className="flex gap-2">
        <button onClick={onClear} className="h-11 px-4 rounded-xl border border-[#1A2B4A] text-sm text-[#4D6B9A] font-semibold hover:bg-[#0F1B3D] transition-all">Clear</button>
        <button onClick={handlePlace} disabled={loading || stakeKobo < 10_000} className="flex-1 h-11 rounded-xl bg-[#0066FF] text-white font-bold text-sm shadow-[0_0_16px_rgba(0,102,255,0.35)] hover:bg-[#0052CC] disabled:opacity-50 disabled:shadow-none transition-all">
          {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Place Bet · ₦${(stakeKobo / 100).toLocaleString()}`}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HorseRacingPage() {
  const [race, setRace]         = useState<Race | null>(null)
  const [results, setResults]   = useState<RaceResult[]>([])
  const [selections, setSelections] = useState<Selection[]>([])
  const [slipOpen, setSlipOpen] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading]   = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [raceRes, resultsRes] = await Promise.all([
        api.get<Race>('/virtual/horse-racing/current'),
        api.get<RaceResult[]>('/virtual/horse-racing/results?limit=6'),
      ])
      setRace(raceRes.data ?? null)
      setResults(resultsRes.data ?? [])
    } catch {
      setRace(null)
      setResults([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  // WebSocket for live race card updates
  useEffect(() => {
    const socket = io(WS_URL, {
      query: { game: 'horse-racing' },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    socket.on('hr:race_card', (payload: Race) => setRace(payload))
    socket.on('hr:result', () => { fetchData() })
    return () => { socket.disconnect() }
  }, [fetchData])

  const toggleSelection = (horse: Horse, market: 'win' | 'place') => {
    setSelections((prev) => {
      const exists = prev.find((s) => s.horseId === horse.id && s.market === market)
      if (exists) return prev.filter((s) => !(s.horseId === horse.id && s.market === market))
      const odds = market === 'win' ? horse.winOdds : horse.placeOdds
      return [...prev, { horseId: horse.id, horseName: horse.name, market, odds }]
    })
    setSlipOpen(true)
  }

  const removeSelection = (horseId: number) => setSelections((prev) => prev.filter((s) => s.horseId !== horseId))
  const clearSelections = () => { setSelections([]); setSlipOpen(false) }

  useEffect(() => { if (selections.length === 0) setSlipOpen(false) }, [selections.length])

  const cd = useCountdown(race?.cycleAt ?? new Date(Date.now() + 999999).toISOString())
  const bettingOpen = race?.status === 'BETTING_OPEN' && !cd.isClosing && !cd.isExpired

  return (
    <div className="flex flex-col min-h-full pb-32 lg:pb-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#070B1A]/95 backdrop-blur-md border-b border-[#1A2B4A] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[#F59E0B]" />
              <h1 className="text-base font-extrabold text-[#E6F1FF]">Horse Racing</h1>
              {race && <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#00C48C]/10 text-[#00C48C] border border-[#00C48C]/20 rounded-md">LIVE</span>}
            </div>
            {race && <p className="text-[10px] text-[#4D6B9A]">Race #{race.raceNumber} · 3-minute rounds · Provably fair</p>}
          </div>
          {race && (
            <div className={cn('text-sm font-bold tabular-nums', cd.isClosing ? 'text-[#EF4444]' : 'text-[#00C48C]')}>
              <Clock size={11} className="inline mr-1" />
              {cd.isExpired ? 'Settling…' : cd.isClosing ? 'Closing' : `${cd.mins}:${String(cd.secs).padStart(2,'0')}`}
            </div>
          )}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-4 px-4 mt-4 gap-0">
        <div>
          {loading ? (
            <div className="space-y-2">{Array.from({length:8}).map((_,i) => <div key={i} className="h-16 bg-[#0F1B3D] rounded-xl animate-pulse" />)}</div>
          ) : !race ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Zap size={36} className="text-[#1A2B4A]" />
              <p className="text-[#4D6B9A] text-sm">No race currently active</p>
            </div>
          ) : (
            <>
              {/* Track visualization */}
              <div className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl mb-4 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#081226] border-b border-[#1A2B4A]">
                  <div className="flex items-center gap-2">
                    <Trophy size={12} className="text-[#F59E0B]" />
                    <span className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider">Race #{race.raceNumber} · {race.horses.length} runners</span>
                  </div>
                  {!bettingOpen && (
                    <span className="flex items-center gap-1 text-[10px] text-[#EF4444] font-semibold">
                      <Lock size={10} /> Betting closed
                    </span>
                  )}
                </div>
                <div className="divide-y divide-[#0F1B3D]/60">
                  {race.horses.map((horse) => (
                    <HorseRow
                      key={horse.id}
                      horse={horse}
                      sel={selections.find((s) => s.horseId === horse.id)}
                      onSelect={(market) => toggleSelection(horse, market)}
                      disabled={!bettingOpen}
                    />
                  ))}
                </div>
                <div className="px-4 py-2 bg-[#081226] border-t border-[#1A2B4A]">
                  <p className="text-[9px] text-[#2A4070]">Seed hash: <span className="font-mono">{race.seedHash.slice(0,24)}…</span> · Revealed after settlement</p>
                </div>
              </div>

              {/* Recent results */}
              <button onClick={() => setShowResults((v) => !v)} className="flex items-center justify-between w-full text-xs font-semibold text-[#4D6B9A] hover:text-[#E6F1FF] mb-2 transition-colors">
                <span>Recent Results</span>
                {showResults ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showResults && (
                <div className="space-y-2">
                  {results.map((r) => (
                    <div key={r.id} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-[#4D6B9A]">Race #{r.raceNumber}</span>
                        <span className="text-[10px] text-[#4D6B9A]">{new Intl.DateTimeFormat('en-NG', { hour:'2-digit', minute:'2-digit' }).format(new Date(r.cycleAt))}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.finishingOrder.slice(0,4).map((h, i) => (
                          <div key={h.id} className="flex items-center gap-1">
                            <span className={cn('text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center', i===0?'bg-[#F59E0B] text-[#070B1A]':i===1?'bg-[#94A3B8] text-[#070B1A]':i===2?'bg-[#B45309] text-white':'bg-[#1A2B4A] text-[#4D6B9A]')}>{i+1}</span>
                            <span className="text-[10px] text-[#E6F1FF]">{h.name}</span>
                            {i < 3 && <span className="text-[#1A2B4A]">·</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop bet slip */}
        <div className="hidden lg:block">
          {selections.length > 0 && race ? (
            <div className="sticky top-20 bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl p-4">
              <h3 className="text-sm font-bold text-[#E6F1FF] mb-4">Bet Slip ({selections.length})</h3>
              <BetSlip race={race} selections={selections} onRemove={removeSelection} onClear={clearSelections} onSuccess={clearSelections} />
            </div>
          ) : (
            <div className="sticky top-20 flex flex-col items-center gap-3 py-10 bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl">
              <Trophy size={28} className="text-[#1A2B4A]" />
              <p className="text-sm text-[#4D6B9A]">Pick a horse to bet</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: fixed bottom bar */}
      {selections.length > 0 && !slipOpen && (
        <div className="lg:hidden fixed bottom-14 left-0 right-0 z-40 px-4 pb-2">
          <button onClick={() => setSlipOpen(true)} className="w-full h-12 bg-[#0066FF] text-white font-bold rounded-xl flex items-center justify-between px-5 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
            <span>{selections.length} selection{selections.length > 1 ? 's' : ''}</span>
            <span>Place Bet →</span>
          </button>
        </div>
      )}

      {/* Mobile: slide-up slip — z-[60] to clear the bottom nav (z-50) */}
      {race && (
        <div
          className={cn('lg:hidden fixed inset-x-0 bottom-0 z-[60] transition-transform duration-300 ease-out', slipOpen ? 'translate-y-0' : 'translate-y-full')}
          style={{ maxHeight: '85dvh' }}
        >
          <div className="bg-[#0F1B3D] border-t border-x border-[#1A2B4A] rounded-t-3xl p-5 pb-8 overflow-y-auto" style={{ maxHeight: '85dvh' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#E6F1FF]">Bet Slip ({selections.length})</h3>
              <button onClick={() => setSlipOpen(false)} className="w-7 h-7 rounded-full bg-[#1A2B4A] flex items-center justify-center text-[#4D6B9A]"><X size={13} /></button>
            </div>
            <BetSlip race={race} selections={selections} onRemove={removeSelection} onClear={clearSelections} onSuccess={clearSelections} />
          </div>
        </div>
      )}
      {slipOpen && <div className="lg:hidden fixed inset-0 z-[55] bg-black/50" onClick={() => setSlipOpen(false)} />}
    </div>
  )
}
