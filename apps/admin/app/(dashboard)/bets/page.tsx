'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, Receipt, Trophy, Dices, Ban, Goal } from 'lucide-react'
import { adminApi, getApiError } from '@/lib/api'
import { cn } from '@qiro/ui'

interface VirtualBet {
  id: string
  gameType: 'VIRTUAL_FOOTBALL' | 'DICE' | 'HORSE_RACING'
  roundId: string
  market: string
  pick: string
  oddsDecimal: string
  stakeKobo: string
  payoutKobo: string | null
  status: BetStatus
  createdAt: string
  user: { username: string }
}

type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID'

interface SportSelection {
  id: string
  fixtureId: string
  market: string
  pick: string
  oddsDecimal: string
  result: BetStatus
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
}

interface SportBet {
  id: string
  stakeKobo: string
  totalOdds: string
  potentialWinKobo: string
  actualWinKobo: string | null
  status: BetStatus
  createdAt: string
  user: { username: string }
  selections: SportSelection[]
}

const STATUS_CFG = {
  PENDING: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
  WON:     'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20',
  LOST:    'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
  VOID:    'text-[#4D6B9A] bg-[#4D6B9A]/10 border-[#4D6B9A]/20',
}

const GAME_CFG = {
  SPORTS:           { label: 'Sports',   icon: Goal,   color: 'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20' },
  VIRTUAL_FOOTBALL: { label: 'Football', icon: Trophy, color: 'text-[#0066FF] bg-[#0066FF]/10 border-[#0066FF]/20' },
  DICE:             { label: 'Dice',     icon: Dices,  color: 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20' },
  HORSE_RACING:     { label: 'Racing',   icon: Trophy, color: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20' },
}

function formatNaira(kobo: string | number | null) {
  if (kobo == null) return '—'
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

type StatusFilter = 'ALL' | BetStatus

const PICK_LABELS: Record<string, string> = { '1': 'Home', X: 'Draw', '2': 'Away', Over: 'Over 2.5', Under: 'Under 2.5' }

export default function BetsPage() {
  const [bets, setBets]             = useState<VirtualBet[]>([])
  const [sportBets, setSportBets]   = useState<SportBet[]>([])
  const [filter, setFilter]         = useState<StatusFilter>('ALL')
  const [gameFilter, setGameFilter] = useState<string>('ALL')
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState('')
  const [voiding, setVoiding]       = useState<SportBet | null>(null)

  const isSports = gameFilter === 'SPORTS'

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    setError('')
    try {
      if (gameFilter === 'SPORTS') {
        const res = await adminApi.get<SportBet[]>('/admin/bets/sport')
        setSportBets(res.data ?? [])
      } else {
        const params = gameFilter !== 'ALL' ? `?gameType=${gameFilter}` : ''
        const res = await adminApi.get<VirtualBet[]>(`/admin/bets/virtual${params}`)
        setBets(res.data ?? [])
      }
    } catch (err) {
      setError(getApiError(err, 'Could not load bets'))
    } finally { setLoading(false); setRefreshing(false) }
  }, [gameFilter])

  useEffect(() => { load() }, [load])

  const rows: (VirtualBet | SportBet)[] = isSports ? sportBets : bets
  const visible    = rows.filter((b) => filter === 'ALL' || b.status === filter)
  // Void bets were refunded — neither stake kept nor payout
  const settled    = visible.filter((b) => b.status !== 'VOID')
  const totalStake = settled.reduce((a, b) => a + Number(b.stakeKobo), 0)
  const totalPayout = settled.reduce((a, b) => a + Number(('payoutKobo' in b ? b.payoutKobo : b.actualWinKobo) ?? 0), 0)
  const ggr        = totalStake - totalPayout

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#E6F1FF]">Bets</h1>
          <p className="text-sm text-[#4D6B9A] mt-0.5">
            {visible.length} bets &nbsp;·&nbsp; Stakes {formatNaira(totalStake)} &nbsp;·&nbsp; GGR <span className={ggr >= 0 ? 'text-[#00C48C]' : 'text-[#EF4444]'}>{formatNaira(ggr)}</span>
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 border border-[#1A2B4A] text-[#4D6B9A] hover:text-[#E6F1FF] hover:border-[#0066FF]/40 rounded-xl text-sm font-semibold transition-all">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1.5 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl p-1">
          {(['ALL', 'PENDING', 'WON', 'LOST', 'VOID'] as StatusFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all', filter === f ? 'bg-[#0066FF] text-white' : 'text-[#4D6B9A] hover:text-[#E6F1FF]')}>
              {f === 'ALL' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl p-1">
          {([['ALL','All Virtual'],['VIRTUAL_FOOTBALL','Football'],['DICE','Dice'],['HORSE_RACING','Racing'],['SPORTS','Sports']] as [string, string][]).map(([g, label]) => (
            <button key={g} onClick={() => setGameFilter(g)} className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all', gameFilter === g ? 'bg-[#0066FF] text-white' : 'text-[#4D6B9A] hover:text-[#E6F1FF]')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-4 py-3 mb-4 text-sm text-[#EF4444]">
          <AlertCircle size={15} />{error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-[#0F1B3D] rounded-xl animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Receipt size={36} className="text-[#1A2B4A]" />
          <p className="text-[#4D6B9A] text-sm">No bets found</p>
        </div>
      ) : isSports ? (
        <div className="space-y-2">
          {(visible as SportBet[]).map((bet) => (
            <SportBetRow key={bet.id} bet={bet} onVoid={() => setVoiding(bet)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(visible as VirtualBet[]).map((bet) => {
            const game = GAME_CFG[bet.gameType]
            const GameIcon = game.icon
            return (
              <div key={bet.id} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0', game.color)}>
                  <GameIcon size={10} />{game.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#E6F1FF]">@{bet.user.username}</span>
                    <span className="text-[10px] text-[#4D6B9A]">·</span>
                    <span className="text-xs text-[#4D6B9A] capitalize">{bet.market.replace('_',' ')} · <span className="text-[#E6F1FF]">{bet.pick.toUpperCase()}</span></span>
                    <span className="text-[10px] font-bold text-[#0066FF]">@{Number(bet.oddsDecimal).toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-[#4D6B9A]">{formatTime(bet.createdAt)} · <span className="font-mono">{bet.roundId.slice(0,10)}</span></p>
                </div>
                <div className="text-right shrink-0 min-w-[80px]">
                  <p className="text-xs font-mono font-bold text-[#E6F1FF]">{formatNaira(bet.stakeKobo)}</p>
                  {bet.status === 'WON' && <p className="text-[10px] font-mono text-[#00C48C]">+{formatNaira(bet.payoutKobo)}</p>}
                  {bet.status === 'LOST' && <p className="text-[10px] text-[#EF4444]">—</p>}
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0', STATUS_CFG[bet.status])}>
                  {bet.status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {voiding && (
        <VoidModal
          bet={voiding}
          onCancel={() => setVoiding(null)}
          onDone={() => { setVoiding(null); load(true) }}
        />
      )}
    </div>
  )
}

function SportBetRow({ bet, onVoid }: { bet: SportBet; onVoid: () => void }) {
  return (
    <div className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#E6F1FF]">@{bet.user.username}</span>
            <span className="text-[10px] text-[#4D6B9A]">·</span>
            <span className="text-xs text-[#4D6B9A]">{bet.selections.length === 1 ? 'Single' : `${bet.selections.length}-fold`}</span>
            <span className="text-[10px] font-bold text-[#0066FF]">@{Number(bet.totalOdds).toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-[#4D6B9A]">{formatTime(bet.createdAt)} · <span className="font-mono">{bet.id.slice(0, 8)}</span></p>
        </div>
        <div className="text-right shrink-0 min-w-[90px]">
          <p className="text-xs font-mono font-bold text-[#E6F1FF]">{formatNaira(bet.stakeKobo)}</p>
          {bet.status === 'WON' && <p className="text-[10px] font-mono text-[#00C48C]">+{formatNaira(bet.actualWinKobo)}</p>}
          {bet.status === 'PENDING' && <p className="text-[10px] font-mono text-[#4D6B9A]">to win {formatNaira(bet.potentialWinKobo)}</p>}
          {bet.status === 'VOID' && <p className="text-[10px] text-[#4D6B9A]">refunded</p>}
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0', STATUS_CFG[bet.status])}>
          {bet.status}
        </span>
        {bet.status === 'PENDING' && (
          <button
            onClick={onVoid}
            title="Void bet and refund stake"
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-[#1A2B4A] text-[10px] font-semibold text-[#4D6B9A] hover:text-[#EF4444] hover:border-[#EF4444]/40 transition-all"
          >
            <Ban size={11} /> Void
          </button>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-[#1A2B4A] space-y-1">
        {bet.selections.map((sel) => (
          <div key={sel.id} className="flex items-center gap-2 text-[11px]">
            <span className="flex-1 min-w-0 truncate text-[#E6F1FF]">
              {sel.homeTeam && sel.awayTeam
                ? `${sel.homeTeam} vs ${sel.awayTeam}`
                : <span className="font-mono text-[#4D6B9A]">{sel.fixtureId}</span>}
              {sel.homeScore != null && sel.awayScore != null && (
                <span className="ml-1.5 font-mono text-[#4D6B9A]">{sel.homeScore}–{sel.awayScore}</span>
              )}
            </span>
            <span className="text-[#4D6B9A] shrink-0">{PICK_LABELS[sel.pick] ?? sel.pick}</span>
            <span className="font-bold text-[#0066FF] shrink-0">@{Number(sel.oddsDecimal).toFixed(2)}</span>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0', STATUS_CFG[sel.result])}>{sel.result}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VoidModal({ bet, onCancel, onDone }: { bet: SportBet; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    setLoading(true)
    setError('')
    try {
      await adminApi.post(`/admin/bets/sport/${bet.id}/void`, { reason: reason.trim() || undefined })
      onDone()
    } catch (err) {
      setError(getApiError(err, 'Could not void bet'))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-base font-bold text-[#E6F1FF] mb-1">Void bet</h3>
        <p className="text-sm text-[#4D6B9A] mb-5">
          Refunds {formatNaira(bet.stakeKobo)} to @{bet.user.username} and voids all pending selections. This can&apos;t be undone.
        </p>
        {error && (
          <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2 mb-4 text-sm text-[#EF4444]">
            <AlertCircle size={15} />{error}
          </div>
        )}
        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Fixture postponed, odds error…"
            className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 py-2.5 text-sm text-[#E6F1FF] placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] transition-all resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-10 border border-[#1A2B4A] text-[#4D6B9A] font-semibold rounded-xl hover:bg-[#0F1B3D] transition-all text-sm">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="flex-1 h-10 bg-[#EF4444] text-white font-semibold rounded-xl hover:bg-[#DC2626] disabled:opacity-50 transition-all text-sm"
          >
            {loading ? 'Voiding…' : 'Void & refund'}
          </button>
        </div>
      </div>
    </div>
  )
}
