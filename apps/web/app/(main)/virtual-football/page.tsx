'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Trophy, Clock, ChevronDown, X, Minus, Plus, Loader2, CheckCircle2, AlertCircle, History } from 'lucide-react'
import { api } from '@/lib/api'
import { useWalletStore } from '@/store/wallet.store'
import { useVFSocket } from '@/hooks/useVFSocket'
import { cn } from '@qiro/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoundOdds {
  '1x2': { '1': number; X: number; '2': number }
  btts: { yes: number; no: number }
  over_under: { over: number; under: number }
}

interface Round {
  id: string
  league: 'A' | 'B'
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  odds: RoundOdds
  status: string
  cycleAt: string
  rngSeedHash: string
}

interface Result {
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

interface Selection {
  roundId: string
  homeTeam: string
  awayTeam: string
  market: string
  pick: string
  odds: number
  label: string
}

interface UserBet {
  id: string
  roundId: string
  market: string
  pick: string
  oddsDecimal: number
  stakeKobo: number
  payoutKobo: number | null
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  createdAt: string
}

interface MultiBet {
  id: string
  stakeKobo: number
  totalOdds: number
  potentialWinKobo: number
  payoutKobo: number | null
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  createdAt: string
  selections: {
    roundId: string
    market: string
    pick: string
    oddsDecimal: number
    result: 'PENDING' | 'WON' | 'LOST' | 'VOID'
    homeTeam: string
    awayTeam: string
    homeScore: number | null
    awayScore: number | null
  }[]
}

const STATUS_CLS = {
  PENDING: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
  WON:     'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20',
  LOST:    'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
  VOID:    'text-[#4D6B9A] bg-[#4D6B9A]/10 border-[#4D6B9A]/20',
} as const

function MultiBetCard({ bet }: { bet: MultiBet }) {
  return (
    <div className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold text-[#E6F1FF]">Multiple · {bet.selections.length} legs</span>
            <span className="text-[10px] text-[#0066FF] font-bold">@{bet.totalOdds.toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-[#4D6B9A]">
            {new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(bet.createdAt))}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono font-bold text-[#E6F1FF]">{formatNaira(bet.stakeKobo)}</p>
          {bet.status === 'WON' && bet.payoutKobo != null
            ? <p className="text-[10px] font-mono text-[#00C48C]">+{formatNaira(bet.payoutKobo)}</p>
            : bet.status === 'PENDING' && <p className="text-[10px] font-mono text-[#4D6B9A]">to win {formatNaira(bet.potentialWinKobo)}</p>}
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0', STATUS_CLS[bet.status])}>{bet.status}</span>
      </div>
      <div className="mt-2 pt-2 border-t border-[#1A2B4A] space-y-1">
        {bet.selections.map((sel) => (
          <div key={`${sel.roundId}-${sel.market}`} className="flex items-center gap-2 text-[11px]">
            <span className="flex-1 min-w-0 truncate text-[#E6F1FF]">
              {sel.homeTeam} vs {sel.awayTeam}
              {sel.homeScore != null && sel.awayScore != null && <span className="ml-1.5 font-mono text-[#4D6B9A]">{sel.homeScore}–{sel.awayScore}</span>}
            </span>
            <span className="text-[#4D6B9A] shrink-0">{pickLabel(sel.market, sel.pick, sel.homeTeam, sel.awayTeam)}</span>
            <span className="font-bold text-[#0066FF] shrink-0">@{sel.oddsDecimal.toFixed(2)}</span>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0', STATUS_CLS[sel.result])}>{sel.result}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mock data (shown when API is unreachable) ────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pickLabel(market: string, pick: string, homeTeam: string, awayTeam: string): string {
  if (market === '1x2') {
    if (pick === '1') return homeTeam
    if (pick === 'X') return 'Draw'
    if (pick === '2') return awayTeam
  }
  if (market === 'btts') return pick === 'yes' ? 'Both Teams Score' : 'Not Both Teams Score'
  if (market === 'over_under') return pick === 'over' ? 'Over 2.5 Goals' : 'Under 2.5 Goals'
  return pick
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(cycleAt: string) {
  const [ms, setMs] = useState(() => new Date(cycleAt).getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setMs(new Date(cycleAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [cycleAt])

  const secs = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(secs / 60)
  const s = secs % 60
  return { mins, secs: s, isClosing: ms < 30_000, isExpired: ms <= 0 }
}

// ─── OddsButton ───────────────────────────────────────────────────────────────

function OddsButton({
  label, odds, selected, onClick, disabled,
}: {
  label: string; odds: number; selected: boolean; onClick: () => void; disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-xs transition-all min-w-[60px] flex-1',
        selected
          ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-[0_0_12px_rgba(0,102,255,0.4)]'
          : 'bg-[#0F1B3D] border-[#1A2B4A] text-[#4D6B9A] hover:border-[#0066FF]/40 hover:text-[#E6F1FF]',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span className="font-medium text-[10px] leading-none truncate w-full text-center">{label}</span>
      <span className="font-bold text-sm leading-none mt-0.5">{odds.toFixed(2)}</span>
    </button>
  )
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ round, selections, onToggle }: {
  round: Round
  selections: Selection[]
  onToggle: (sel: Selection) => void
}) {
  const { mins, secs, isClosing, isExpired } = useCountdown(round.cycleAt)
  const betting = round.status === 'BETTING_OPEN' && !isClosing && !isExpired

  const isSelected = (market: string, pick: string) =>
    selections.some((s) => s.roundId === round.id && s.market === market && s.pick === pick)

  const toggle = (market: string, pick: string, odds: number) => {
    if (!betting) return
    const label = pickLabel(market, pick, round.homeTeam.name, round.awayTeam.name)
    onToggle({ roundId: round.id, homeTeam: round.homeTeam.name, awayTeam: round.awayTeam.name, market, pick, odds, label })
  }

  return (
    <div className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1A2B4A] bg-[#081226]">
        <div className="flex items-center gap-1.5">
          <Trophy size={12} className="text-[#0066FF]" />
          <span className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider">
            League {round.league}
          </span>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-semibold',
          isClosing || isExpired ? 'text-[#EF4444]' : 'text-[#00C48C]',
        )}>
          <Clock size={11} />
          {isExpired ? 'Settling…' : isClosing ? 'Closing…' : `${mins}:${String(secs).padStart(2, '0')}`}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex-1 text-center">
          <p className="text-sm font-bold text-[#E6F1FF] leading-tight">{round.homeTeam.name}</p>
          <p className="text-[10px] text-[#4D6B9A] mt-1">Home</p>
        </div>
        <div className="px-4">
          <span className="text-[10px] font-black text-[#1A2B4A] bg-[#081226] px-3 py-1.5 rounded-lg">VS</span>
        </div>
        <div className="flex-1 text-center">
          <p className="text-sm font-bold text-[#E6F1FF] leading-tight">{round.awayTeam.name}</p>
          <p className="text-[10px] text-[#4D6B9A] mt-1">Away</p>
        </div>
      </div>

      {/* Markets */}
      <div className="px-3 pb-3 space-y-2.5">
        {/* 1X2 */}
        <div>
          <p className="text-[10px] text-[#4D6B9A] uppercase tracking-wider font-semibold mb-1.5 px-0.5">Match Result</p>
          <div className="flex gap-1.5">
            {(['1', 'X', '2'] as const).map((pick) => (
              <OddsButton
                key={pick}
                label={pick === '1' ? '1 Home' : pick === 'X' ? 'X Draw' : '2 Away'}
                odds={round.odds['1x2'][pick]}
                selected={isSelected('1x2', pick)}
                onClick={() => toggle('1x2', pick, round.odds['1x2'][pick])}
                disabled={!betting}
              />
            ))}
          </div>
        </div>

        {/* BTTS + O/U */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-[#4D6B9A] uppercase tracking-wider font-semibold mb-1.5 px-0.5">BTTS</p>
            <div className="flex gap-1.5">
              {(['yes', 'no'] as const).map((pick) => (
                <OddsButton
                  key={pick}
                  label={pick === 'yes' ? 'Yes' : 'No'}
                  odds={round.odds.btts[pick]}
                  selected={isSelected('btts', pick)}
                  onClick={() => toggle('btts', pick, round.odds.btts[pick])}
                  disabled={!betting}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-[#4D6B9A] uppercase tracking-wider font-semibold mb-1.5 px-0.5">Goals O/U 2.5</p>
            <div className="flex gap-1.5">
              {(['over', 'under'] as const).map((pick) => (
                <OddsButton
                  key={pick}
                  label={pick === 'over' ? 'Over' : 'Under'}
                  odds={round.odds.over_under[pick]}
                  selected={isSelected('over_under', pick)}
                  onClick={() => toggle('over_under', pick, round.odds.over_under[pick])}
                  disabled={!betting}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bet Slip ─────────────────────────────────────────────────────────────────

const MIN_STAKE_KOBO = 10_000      // ₦100 — per bet
const MAX_WIN_KOBO = 100_000_000   // ₦1,000,000 — payout cap

type SlipMode = 'single' | 'multi'

function BetSlip({ selections, onRemove, onClear, onBetPlaced }: {
  selections: Selection[]
  onRemove: (roundId: string, market: string, pick: string) => void
  onClear: () => void
  onBetPlaced: () => void
}) {
  const [stakeInput, setStakeInput] = useState('')
  const [mode, setMode] = useState<SlipMode>('single')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const setBalance = useWalletStore((s) => s.setBalance)

  const stakeKobo = Math.floor((parseFloat(stakeInput) || 0) * 100)
  const n = selections.length

  // Multiple: one selection per match, at least two matches
  const roundIds = selections.map((s) => s.roundId)
  const sameMatch = new Set(roundIds).size !== roundIds.length
  const canMulti = n >= 2 && !sameMatch
  const isMulti = mode === 'multi' && canMulti

  // Single: the stake is split evenly across selections (whole naira only, so no kobo crumbs)
  const perSelectionKobo = n > 0 ? Math.floor(stakeKobo / n / 100) * 100 : 0
  const singlesTotalKobo = perSelectionKobo * n
  const singlesReturnKobo = selections.reduce((sum, s) => sum + Math.min(Math.floor(perSelectionKobo * s.odds), MAX_WIN_KOBO), 0)

  // Multiple: one stake at the product of all odds
  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1)
  const multiReturnKobo = Math.min(Math.floor(stakeKobo * totalOdds), MAX_WIN_KOBO)

  const chargeKobo = isMulti ? stakeKobo : singlesTotalKobo
  const validationError =
    stakeKobo === 0 ? '' :
    isMulti
      ? (stakeKobo < MIN_STAKE_KOBO ? 'Minimum stake is ₦100' : '')
      : (perSelectionKobo < MIN_STAKE_KOBO
          ? `₦${(perSelectionKobo / 100).toLocaleString()} per selection is below the ₦100 minimum — stake at least ₦${(n * 100).toLocaleString()}`
          : '')

  const handlePlace = async () => {
    if (n === 0 || stakeKobo === 0 || validationError) return
    setLoading(true)
    setError('')

    try {
      if (isMulti) {
        await api.post('/virtual/football/multi-bet', {
          selections: selections.map((s) => ({ roundId: s.roundId, market: s.market, pick: s.pick })),
          stakeKobo,
        })
      } else {
        // One request — the API places every single or none of them
        await api.post('/virtual/football/bets', {
          bets: selections.map((s) => ({ roundId: s.roundId, market: s.market, pick: s.pick, stakeKobo: perSelectionKobo })),
        })
      }
      const balRes = await api.get<{ balanceKobo: number }>('/wallet/balance')
      setBalance(balRes.data.balanceKobo)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onBetPlaced()
      }, 2000)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setError((Array.isArray(message) ? message[0] : message) ?? 'Failed to place bet')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full bg-[#00C48C]/10 flex items-center justify-center">
          <CheckCircle2 className="text-[#00C48C]" size={28} />
        </div>
        <p className="font-bold text-[#E6F1FF]">{isMulti ? 'Multiple Placed!' : n > 1 ? `${n} Bets Placed!` : 'Bet Placed!'}</p>
        <p className="text-sm text-[#4D6B9A]">Good luck! Results in moments.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Single / Multiple */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#081226] border border-[#1A2B4A] rounded-xl">
        {([['single', 'Single'], ['multi', 'Multiple']] as [SlipMode, string][]).map(([m, label]) => {
          const disabled = m === 'multi' && !canMulti
          return (
            <button
              key={m}
              onClick={() => !disabled && setMode(m)}
              disabled={disabled}
              className={cn(
                'h-8 rounded-lg text-xs font-bold transition-all',
                (m === 'multi' ? isMulti : !isMulti)
                  ? 'bg-[#0066FF] text-white shadow-[0_0_12px_rgba(0,102,255,0.35)]'
                  : 'text-[#4D6B9A] hover:text-[#E6F1FF] disabled:opacity-40 disabled:hover:text-[#4D6B9A]',
              )}
            >
              {label}
              {m === 'multi' && canMulti && <span className="ml-1 font-black tabular-nums">@{totalOdds.toFixed(2)}</span>}
            </button>
          )
        })}
      </div>
      {mode === 'multi' && !canMulti && (
        <p className="text-[10px] text-[#F59E0B] -mt-1">
          {n < 2 ? 'Add selections from at least 2 matches for a Multiple.' : 'A Multiple allows one selection per match — remove the extra picks from the same match.'}
        </p>
      )}

      <div className="space-y-2">
        {selections.map((s) => (
          <div key={`${s.roundId}-${s.market}-${s.pick}`} className="flex items-center gap-2 bg-[#081226] rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#E6F1FF] truncate">{s.label}</p>
              <p className="text-[10px] text-[#4D6B9A] truncate">{s.homeTeam} vs {s.awayTeam}</p>
            </div>
            <span className="text-sm font-bold text-[#0066FF] tabular-nums shrink-0">{s.odds.toFixed(2)}</span>
            <button onClick={() => onRemove(s.roundId, s.market, s.pick)} className="text-[#4D6B9A] hover:text-[#EF4444] transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Stake */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-[#4D6B9A] uppercase tracking-wider">
          {isMulti ? 'Stake (₦)' : n > 1 ? `Total Stake (₦) · ${formatNaira(perSelectionKobo)} per selection` : 'Stake (₦)'}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStakeInput((v) => String(Math.max(100, (parseFloat(v) || 0) - 100)))}
            className="w-9 h-9 rounded-xl bg-[#081226] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            placeholder="0"
            min="100"
            className="flex-1 bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 py-2 text-center text-[#E6F1FF] text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
          />
          <button
            onClick={() => setStakeInput((v) => String((parseFloat(v) || 0) + 100))}
            className="w-9 h-9 rounded-xl bg-[#081226] border border-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1.5">
          {[500, 1000, 2000, 5000].map((v) => (
            <button
              key={v}
              onClick={() => setStakeInput(String(v))}
              className="flex-1 py-1 rounded-lg bg-[#081226] border border-[#1A2B4A] text-[10px] font-semibold text-[#4D6B9A] hover:border-[#0066FF]/40 hover:text-[#E6F1FF] transition-all"
            >
              ₦{v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#081226] rounded-xl px-3 py-2.5 space-y-1.5">
        {isMulti ? (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-[#4D6B9A]">Combined odds ({n} selections)</span>
              <span className="font-bold text-[#0066FF] tabular-nums">{totalOdds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#4D6B9A]">Potential win</span>
              <span className="font-black text-[#00C48C] tabular-nums">{formatNaira(multiReturnKobo)}</span>
            </div>
            <p className="text-[10px] text-[#4D6B9A]">All {n} selections must win.</p>
          </>
        ) : (
          <>
            {selections.map((s) => (
              <div key={`${s.roundId}-${s.market}-${s.pick}`} className="flex justify-between text-xs">
                <span className="text-[#4D6B9A] truncate max-w-[60%]">{s.label}</span>
                <span className="font-semibold text-[#E6F1FF]">
                  {formatNaira(perSelectionKobo)} → {formatNaira(Math.min(Math.floor(perSelectionKobo * s.odds), MAX_WIN_KOBO))}
                </span>
              </div>
            ))}
            {n > 1 && (
              <div className="flex justify-between text-xs pt-1.5 border-t border-[#1A2B4A]">
                <span className="text-[#4D6B9A]">If all win</span>
                <span className="font-black text-[#00C48C] tabular-nums">{formatNaira(singlesReturnKobo)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {(validationError || error) && (
        <div className="flex items-center gap-2 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} className="shrink-0" />{validationError || error}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onClear} className="h-11 px-4 rounded-xl border border-[#1A2B4A] text-sm text-[#4D6B9A] font-semibold hover:bg-[#0F1B3D] transition-all">
          Clear
        </button>
        <button
          onClick={handlePlace}
          disabled={loading || n === 0 || chargeKobo === 0 || !!validationError}
          className="flex-1 h-11 rounded-xl bg-[#0066FF] text-white font-bold text-sm shadow-[0_0_16px_rgba(0,102,255,0.35)] hover:shadow-[0_0_24px_rgba(0,102,255,0.5)] hover:bg-[#0052CC] disabled:opacity-50 disabled:shadow-none transition-all"
        >
          {loading
            ? <Loader2 size={16} className="animate-spin mx-auto" />
            : isMulti
              ? `Place Multiple · ${formatNaira(chargeKobo)}`
              : `Place ${n > 1 ? `${n} Bets` : 'Bet'} · ${formatNaira(chargeKobo)}`}
        </button>
      </div>
    </div>
  )
}

// ─── Results Row ──────────────────────────────────────────────────────────────

function ResultRow({ result }: { result: Result }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl">
      <span className="text-[10px] font-bold text-[#0066FF] w-5 shrink-0">L{result.league}</span>
      <span className="text-xs text-[#4D6B9A] flex-1 truncate text-right">{result.homeTeam.name}</span>
      <span className="text-xs font-black text-[#E6F1FF] tabular-nums px-2 py-0.5 bg-[#081226] rounded-lg shrink-0">
        {result.homeScore ?? 0} – {result.awayScore ?? 0}
      </span>
      <span className="text-xs text-[#4D6B9A] flex-1 truncate">{result.awayTeam.name}</span>
      <span className="text-[10px] text-[#4D6B9A] shrink-0">
        ({result.halfTimeHome ?? 0}-{result.halfTimeAway ?? 0})
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'all' | 'A' | 'B' | 'mybets'

export default function VirtualFootballPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [myBets, setMyBets] = useState<UserBet[]>([])
  const [myMultis, setMyMultis] = useState<MultiBet[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [slipOpen, setSlipOpen] = useState(false)
  const [selections, setSelections] = useState<Selection[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // WebSocket real-time updates (replaces 10s polling)
  useVFSocket(setRounds, setResults)

  const fetchData = useCallback(async () => {
    try {
      const [roundsRes, resultsRes] = await Promise.all([
        api.get<Round[]>('/virtual/football/current'),
        api.get<Result[]>('/virtual/football/results'),
      ])
      const liveRounds = roundsRes.data ?? []
      const liveResults = resultsRes.data ?? []
      setRounds(liveRounds)
      setResults(liveResults)
    } catch {
      setRounds([])
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMyBets = useCallback(async () => {
    try {
      const res = await api.get<{ bets: UserBet[]; multiBets?: MultiBet[] }>('/virtual/football/my-bets')
      setMyBets(res.data.bets ?? [])
      setMyMultis(res.data.multiBets ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchData()
    // 60s REST fallback in case WebSocket reconnects
    timerRef.current = setInterval(fetchData, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  useEffect(() => {
    if (tab === 'mybets') fetchMyBets()
  }, [tab, fetchMyBets])

  const toggleSelection = (sel: Selection) => {
    setSelections((prev) => {
      const exists = prev.find((s) => s.roundId === sel.roundId && s.market === sel.market && s.pick === sel.pick)
      if (exists) return prev.filter((s) => !(s.roundId === sel.roundId && s.market === sel.market && s.pick === sel.pick))
      const filtered = prev.filter((s) => !(s.roundId === sel.roundId && s.market === sel.market))
      return [...filtered, sel]
    })
    setSlipOpen(true)
  }

  const removeSelection = (roundId: string, market: string, pick: string) => {
    setSelections((prev) => prev.filter((s) => !(s.roundId === roundId && s.market === market && s.pick === pick)))
  }

  const visibleRounds = tab === 'all' || tab === 'mybets' ? rounds : rounds.filter((r) => r.league === tab)
  const visibleResults = tab === 'all' || tab === 'mybets' ? results : results.filter((r) => r.league === tab)

  // Close sheet when all selections removed
  useEffect(() => {
    if (selections.length === 0) setSlipOpen(false)
  }, [selections.length])

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#070B1A]/95 backdrop-blur-md border-b border-[#1A2B4A]">
        <div className="px-4 pt-3 pb-0">
          <div className="mb-3">
            <h1 className="text-base font-extrabold text-[#E6F1FF]">Virtual Football</h1>
            <p className="text-[10px] text-[#4D6B9A]">New matches every 5 minutes · Provably fair</p>
          </div>
          <div className="flex gap-1">
            {(['all', 'A', 'B', 'mybets'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all',
                  tab === t
                    ? 'text-[#0066FF] border-[#0066FF] bg-[#0066FF]/5'
                    : 'text-[#4D6B9A] border-transparent hover:text-[#E6F1FF]',
                )}
              >
                {t === 'mybets' ? <><History size={11} />My Bets</> : t === 'all' ? 'All' : `League ${t}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column layout: matches | bet slip (desktop) */}
      <div className="flex-1 flex lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px]">

        {/* ── Left: matches + results ── */}
        <div className="flex-1 min-w-0 px-4 py-3 pb-32 lg:pb-6 space-y-5">

          {/* Current rounds */}
          {tab !== 'mybets' && (
            <section>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => <div key={i} className="h-52 bg-[#0F1B3D] rounded-2xl animate-pulse" />)}
                </div>
              ) : visibleRounds.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14">
                  <Trophy size={40} className="text-[#1A2B4A]" />
                  <p className="text-[#4D6B9A] text-sm">No active rounds — check back shortly</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRounds.map((round) => (
                    <MatchCard key={round.id} round={round} selections={selections} onToggle={toggleSelection} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recent results */}
          {tab !== 'mybets' && visibleResults.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider mb-2">Recent Results</h2>
              <div className="space-y-1.5">
                {visibleResults.slice(0, 8).map((r) => <ResultRow key={r.id} result={r} />)}
              </div>
            </section>
          )}

        {/* My bets */}
        {tab === 'mybets' && (
          <section>
            {myBets.length === 0 && myMultis.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14">
                <History size={40} className="text-[#1A2B4A]" />
                <p className="text-[#4D6B9A] text-sm">No bets placed yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myMultis.map((m) => <MultiBetCard key={m.id} bet={m} />)}
                {myBets.map((bet) => {
                  const cfg = STATUS_CLS[bet.status]
                  return (
                    <div key={bet.id} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold text-[#E6F1FF] capitalize">
                            {bet.market === '1x2' ? '1X2' : bet.market.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-[#4D6B9A]">·</span>
                          <span className="text-xs text-[#4D6B9A] font-semibold">{bet.pick.toUpperCase()}</span>
                          <span className="text-[10px] text-[#0066FF] font-bold">@{bet.oddsDecimal.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-[#4D6B9A]">
                          {new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(bet.createdAt))}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-bold text-[#E6F1FF]">{formatNaira(bet.stakeKobo)}</p>
                        {bet.status === 'WON' && bet.payoutKobo != null && (
                          <p className="text-[10px] font-mono text-[#00C48C]">+{formatNaira(bet.payoutKobo)}</p>
                        )}
                      </div>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0', cfg)}>
                        {bet.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
        </div>{/* end left col */}

        {/* ── Right: Bet Slip — desktop only ── */}
        <div className="hidden lg:block border-l border-[#1A2B4A] bg-[#081226]/60">
          <div className="sticky top-0 p-4 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#E6F1FF]">Bet Slip</span>
              {selections.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#0066FF]/15 text-[#0066FF] border border-[#0066FF]/30 rounded-full">
                  {selections.length}
                </span>
              )}
            </div>

            {selections.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#0F1B3D] border border-[#1A2B4A] flex items-center justify-center">
                  <Trophy size={20} className="text-[#1A2B4A]" />
                </div>
                <p className="text-xs text-[#4D6B9A] leading-relaxed">
                  Select odds from a match<br />to build your bet slip
                </p>
              </div>
            ) : (
              <BetSlip
                selections={selections}
                onRemove={removeSelection}
                onClear={() => setSelections([])}
                onBetPlaced={() => { setSelections([]); fetchData() }}
              />
            )}
          </div>
        </div>

      </div>{/* end grid */}

      {/* ── Mobile: fixed bottom bar + slide-up sheet ── */}
      {selections.length > 0 && (
        <>
          {/* Fixed bar above bottom nav */}
          <div className="lg:hidden fixed bottom-14 inset-x-0 z-40 px-4 pb-2">
            <button
              onClick={() => setSlipOpen(true)}
              className="w-full h-13 flex items-center justify-between px-4 py-3 bg-[#0066FF] rounded-xl shadow-[0_0_24px_rgba(0,102,255,0.45)] text-white"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/20 text-[10px] font-black flex items-center justify-center">
                  {selections.length}
                </span>
                <span className="text-sm font-bold">View Bet Slip</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {selections.reduce((a, s) => a * s.odds, 1).toFixed(2)}x
                </span>
                <ChevronDown size={16} className="rotate-180" />
              </div>
            </button>
          </div>

          {/* Backdrop — z-[55] sits above nav (z-50) but below sheet */}
          {slipOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
              onClick={() => setSlipOpen(false)}
            />
          )}

          {/* Slide-up sheet — z-[60] clears the bottom nav (z-50) */}
          <div
            className={cn(
              'lg:hidden fixed inset-x-0 bottom-0 z-[60] bg-[#0F1B3D] rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.6)] transition-transform duration-300',
              slipOpen ? 'translate-y-0' : 'translate-y-full',
            )}
            style={{ maxHeight: '85dvh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#1A2B4A]" />
            </div>

            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-[#E6F1FF]">
                Bet Slip · {selections.length} selection{selections.length > 1 ? 's' : ''}
              </span>
              <button onClick={() => setSlipOpen(false)} className="text-[#4D6B9A] hover:text-[#E6F1FF] p-1">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pb-10 overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 70px)' }}>
              <BetSlip
                selections={selections}
                onRemove={removeSelection}
                onClear={() => { setSelections([]); setSlipOpen(false) }}
                onBetPlaced={() => { setSelections([]); setSlipOpen(false); fetchData() }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
