'use client'

import { useState, useCallback } from 'react'
import { Minus, Plus, Loader2, RotateCcw, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { useWalletStore } from '@/store/wallet.store'
import { useToastStore } from '@/store/toast.store'
import { cn } from '@qiro/ui'

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUSE_EDGE = 0.02
const MIN_THRESHOLD = 2
const MAX_THRESHOLD = 98
const MIN_STAKE = 100  // NGN
const MAX_WIN_NAIRA = 1_000_000

// ─── Math helpers ─────────────────────────────────────────────────────────────

function winProbability(threshold: number, direction: 'OVER' | 'UNDER'): number {
  return direction === 'OVER' ? (100 - threshold) / 101 : threshold / 101
}

function multiplier(threshold: number, direction: 'OVER' | 'UNDER'): number {
  const prob = winProbability(threshold, direction)
  return Math.floor(((1 - HOUSE_EDGE) / prob) * 100) / 100
}

function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Roll result bar ──────────────────────────────────────────────────────────

function RollBar({
  threshold,
  direction,
  rolledNumber,
  won,
}: {
  threshold: number
  direction: 'OVER' | 'UNDER'
  rolledNumber: number | null
  won: boolean | null
}) {
  const winZoneLeft = direction === 'UNDER' ? 0 : threshold
  const winZoneRight = direction === 'UNDER' ? threshold : 100
  const winPercent = winZoneRight - winZoneLeft

  return (
    <div className="relative w-full">
      {/* Track */}
      <div className="relative h-5 rounded-full overflow-hidden bg-[#081226] border border-[#1A2B4A]">
        {/* Lose zone */}
        <div className="absolute inset-y-0 bg-[#EF4444]/20" style={{
          left: direction === 'UNDER' ? `${threshold}%` : '0%',
          width: direction === 'UNDER' ? `${100 - threshold}%` : `${threshold}%`,
        }} />
        {/* Win zone */}
        <div
          className="absolute inset-y-0 bg-[#00C48C]/25"
          style={{ left: `${winZoneLeft}%`, width: `${winPercent}%` }}
        />
        {/* Threshold marker */}
        <div
          className="absolute inset-y-0 w-0.5 bg-[#E6F1FF]/50"
          style={{ left: `${threshold}%` }}
        />
        {/* Rolled number marker */}
        {rolledNumber !== null && (
          <div
            className={cn(
              'absolute inset-y-0 w-1 rounded-full transition-all duration-700',
              won ? 'bg-[#00C48C] shadow-[0_0_8px_rgba(0,196,140,0.8)]' : 'bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.8)]',
            )}
            style={{ left: `${rolledNumber}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[10px] text-[#4D6B9A]">0</span>
        <span className="text-[10px] text-[#4D6B9A]">50</span>
        <span className="text-[10px] text-[#4D6B9A]">100</span>
      </div>
    </div>
  )
}

// ─── History row ──────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string
  rolled: number
  threshold: number
  direction: 'OVER' | 'UNDER'
  won: boolean
  stakeKobo: number
  payoutKobo: number
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-xl border text-xs transition-all',
      entry.won
        ? 'bg-[#00C48C]/5 border-[#00C48C]/15'
        : 'bg-[#EF4444]/5 border-[#EF4444]/10',
    )}>
      <span className={cn(
        'font-black text-base tabular-nums w-8 text-center',
        entry.won ? 'text-[#00C48C]' : 'text-[#EF4444]',
      )}>
        {entry.rolled}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[#E6F1FF] font-semibold">
          {entry.direction === 'OVER' ? 'Over' : 'Under'} {entry.threshold}
        </p>
        <p className="text-[10px] text-[#4D6B9A]">Stake: {formatNaira(entry.stakeKobo)}</p>
      </div>
      <span className={cn('font-bold tabular-nums', entry.won ? 'text-[#00C48C]' : 'text-[#4D6B9A]')}>
        {entry.won ? `+${formatNaira(entry.payoutKobo - entry.stakeKobo)}` : `-${formatNaira(entry.stakeKobo)}`}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DicePage() {
  const pushToast  = useToastStore((s) => s.push)
  const [threshold, setThreshold] = useState(50)
  const [direction, setDirection] = useState<'OVER' | 'UNDER'>('OVER')
  const [stakeInput, setStakeInput] = useState('500')
  const [rolling, setRolling] = useState(false)
  const [displayNumber, setDisplayNumber] = useState<number | null>(null)
  const [won, setWon] = useState<boolean | null>(null)
  const [lastPayout, setLastPayout] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showSeed, setShowSeed] = useState<{ hash: string; seed: string } | null>(null)

  const setBalance = useWalletStore((s) => s.setBalance)

  const stakeKobo = Math.floor((parseFloat(stakeInput) || 0) * 100)
  const mult = multiplier(threshold, direction)
  const winProb = winProbability(threshold, direction)
  const potentialWinKobo = Math.min(Math.floor(stakeKobo * mult), MAX_WIN_NAIRA * 100)

  const handleRoll = useCallback(async () => {
    if (rolling || stakeKobo < MIN_STAKE * 100) return
    setRolling(true)
    setError('')
    setWon(null)
    setShowSeed(null)

    // Animate a spinning number before result arrives
    let frame = 0
    const spin = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 101))
      frame++
      if (frame > 12) clearInterval(spin)
    }, 60)

    try {
      const res = await api.post<{
        rolledNumber: number
        won: boolean
        payoutKobo: number
        multiplier: number
        seedHash: string
        seed: string
      }>('/virtual/dice/roll', {
        threshold,
        direction,
        stakeKobo,
      })

      clearInterval(spin)
      const { rolledNumber, won: didWin, payoutKobo, seedHash, seed } = res.data

      setDisplayNumber(rolledNumber)
      setWon(didWin)
      setLastPayout(payoutKobo)
      setShowSeed({ hash: seedHash, seed })

      pushToast({
        type: didWin ? 'win' : 'loss',
        title: didWin ? `Rolled ${rolledNumber} — You won!` : `Rolled ${rolledNumber} — Lost`,
        body: didWin ? `+${formatNaira(payoutKobo - stakeKobo)} profit` : undefined,
      })

      setHistory((prev) => [
        { id: `${Date.now()}`, rolled: rolledNumber, threshold, direction, won: didWin, stakeKobo, payoutKobo },
        ...prev.slice(0, 19),
      ])

      // Refresh balance
      api.get<{ balanceKobo: number }>('/wallet/balance')
        .then((r) => setBalance(r.data.balanceKobo))
        .catch(() => null)

    } catch (err: unknown) {
      clearInterval(spin)
      setDisplayNumber(null)
      const e = err as { response?: { data?: { message?: string | string[] } } }
      const message = e.response?.data?.message
      setError(
        !e.response
          ? "Can't reach the game server. Check your connection and try again."
          : (Array.isArray(message) ? message[0] : message) ?? 'Roll failed. Try again.',
      )
    } finally {
      setRolling(false)
    }
  }, [rolling, stakeKobo, threshold, direction, setBalance])

  const clampThreshold = (v: number) => Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, v))

  return (
    <div className="flex flex-col min-h-full pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1A2B4A]">
        <h1 className="text-base font-extrabold text-[#E6F1FF]">Dice</h1>
        <p className="text-[10px] text-[#4D6B9A]">Roll 0–100 · 2% house edge · Provably fair</p>
      </div>

      <div className="flex-1 lg:grid lg:grid-cols-[1fr_320px]">

        {/* ── Game panel ── */}
        <div className="px-4 py-4 space-y-5">

          {/* Big number display */}
          <div className="flex flex-col items-center gap-2 py-6 bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl relative overflow-hidden">
            {/* Ambient glow on win/loss */}
            {won !== null && (
              <div className={cn(
                'absolute inset-0 transition-opacity duration-500',
                won ? 'bg-[#00C48C]/5' : 'bg-[#EF4444]/5',
              )} />
            )}

            <span className={cn(
              'text-7xl font-black tabular-nums transition-all duration-300 relative',
              won === null ? 'text-[#1A2B4A]' : won ? 'text-[#00C48C]' : 'text-[#EF4444]',
              displayNumber !== null && 'scale-105',
            )}>
              {displayNumber ?? '—'}
            </span>

            {won !== null && (
              <div className={cn(
                'flex items-center gap-1.5 text-sm font-bold relative',
                won ? 'text-[#00C48C]' : 'text-[#EF4444]',
              )}>
                {won
                  ? <><TrendingUp size={15} /> Win! +{formatNaira((lastPayout ?? 0) - stakeKobo)}</>
                  : <><TrendingDown size={15} /> Lost {formatNaira(stakeKobo)}</>
                }
              </div>
            )}

            <p className="text-[10px] text-[#4D6B9A] relative">
              {won === null
                ? 'Set your bet and roll'
                : direction === 'OVER'
                  ? `${displayNumber} ${displayNumber! > threshold ? '>' : '≤'} ${threshold}`
                  : `${displayNumber} ${displayNumber! < threshold ? '<' : '≥'} ${threshold}`}
            </p>
          </div>

          {/* Roll bar */}
          <RollBar
            threshold={threshold}
            direction={direction}
            rolledNumber={displayNumber}
            won={won}
          />

          {/* Direction toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(['UNDER', 'OVER'] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setDirection(d); setDisplayNumber(null); setWon(null) }}
                className={cn(
                  'h-11 rounded-xl font-bold text-sm border transition-all',
                  direction === d
                    ? d === 'OVER'
                      ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-[0_0_16px_rgba(0,102,255,0.35)]'
                      : 'bg-[#00D4FF]/10 border-[#00D4FF]/40 text-[#00D4FF]'
                    : 'bg-[#0F1B3D] border-[#1A2B4A] text-[#4D6B9A] hover:border-[#0066FF]/30 hover:text-[#E6F1FF]',
                )}
              >
                Roll {d === 'OVER' ? 'Over' : 'Under'} {threshold}
              </button>
            ))}
          </div>

          {/* Threshold slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-[#4D6B9A] uppercase tracking-wider">Threshold</label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setThreshold((v) => clampThreshold(v - 1)); setDisplayNumber(null); setWon(null) }}
                  className="w-7 h-7 rounded-lg bg-[#081226] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] text-xs font-bold transition-colors"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => { setThreshold(clampThreshold(Number(e.target.value))); setDisplayNumber(null); setWon(null) }}
                  className="w-14 bg-[#081226] border border-[#1A2B4A] rounded-lg px-2 py-1 text-center text-[#E6F1FF] text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
                />
                <button
                  onClick={() => { setThreshold((v) => clampThreshold(v + 1)); setDisplayNumber(null); setWon(null) }}
                  className="w-7 h-7 rounded-lg bg-[#081226] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] text-xs font-bold transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              value={threshold}
              onChange={(e) => { setThreshold(Number(e.target.value)); setDisplayNumber(null); setWon(null) }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#0066FF] bg-[#1A2B4A]"
            />
            {/* Quick thresholds */}
            <div className="flex gap-1.5">
              {[25, 40, 50, 60, 75].map((t) => (
                <button
                  key={t}
                  onClick={() => { setThreshold(t); setDisplayNumber(null); setWon(null) }}
                  className={cn(
                    'flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-all',
                    threshold === t
                      ? 'bg-[#0066FF]/10 border-[#0066FF]/30 text-[#0066FF]'
                      : 'bg-[#081226] border-[#1A2B4A] text-[#4D6B9A] hover:border-[#0066FF]/20 hover:text-[#E6F1FF]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Win chance', value: `${(winProb * 100).toFixed(1)}%` },
              { label: 'Multiplier', value: `${mult.toFixed(2)}×` },
              { label: 'Potential win', value: formatNaira(potentialWinKobo) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-2 py-2 text-center">
                <p className="text-[10px] text-[#4D6B9A] mb-0.5">{label}</p>
                <p className="text-xs font-bold text-[#E6F1FF] tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Stake */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4D6B9A] uppercase tracking-wider">Stake (₦)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStakeInput((v) => String(Math.max(MIN_STAKE, (parseFloat(v) || 0) - 100)))}
                className="w-10 h-10 rounded-xl bg-[#0F1B3D] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                placeholder="0"
                className="flex-1 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-3 py-2.5 text-center text-[#E6F1FF] text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
              />
              <button
                onClick={() => setStakeInput((v) => String((parseFloat(v) || 0) + 100))}
                className="w-10 h-10 rounded-xl bg-[#0F1B3D] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex gap-1.5">
              {[200, 500, 1000, 2000, 5000].map((n) => (
                <button
                  key={n}
                  onClick={() => setStakeInput(String(n))}
                  className="flex-1 py-1.5 rounded-lg bg-[#081226] border border-[#1A2B4A] text-[10px] font-semibold text-[#4D6B9A] hover:border-[#0066FF]/30 hover:text-[#E6F1FF] transition-all"
                >
                  {n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          {/* Roll button */}
          <button
            onClick={handleRoll}
            disabled={rolling || stakeKobo < MIN_STAKE * 100}
            className="w-full h-14 rounded-2xl bg-[#0066FF] text-white font-black text-base shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:shadow-[0_0_36px_rgba(0,102,255,0.6)] hover:bg-[#0052CC] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none transition-all"
          >
            {rolling
              ? <Loader2 size={20} className="animate-spin mx-auto" />
              : <span className="flex items-center justify-center gap-2">
                  <RotateCcw size={16} />
                  Roll · {formatNaira(stakeKobo)}
                </span>
            }
          </button>

          {/* Seed info */}
          {showSeed && (
            <div className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-3 py-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Info size={11} className="text-[#4D6B9A]" />
                <span className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider">Provably Fair</span>
              </div>
              <div>
                <p className="text-[10px] text-[#4D6B9A] mb-0.5">Seed hash</p>
                <p className="text-[10px] font-mono text-[#E6F1FF] break-all">{showSeed.hash.slice(0, 32)}…</p>
              </div>
              <div>
                <p className="text-[10px] text-[#4D6B9A] mb-0.5">Revealed seed</p>
                <p className="text-[10px] font-mono text-[#00C48C] break-all">{showSeed.seed.slice(0, 32)}…</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: roll history (desktop sidebar, mobile below) ── */}
        <div className="border-t lg:border-t-0 lg:border-l border-[#1A2B4A] px-4 py-4">
          <h2 className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider mb-3">Roll History</h2>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <RotateCcw size={28} className="text-[#1A2B4A]" />
              <p className="text-xs text-[#4D6B9A]">Your rolls will appear here</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((entry) => <HistoryRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
