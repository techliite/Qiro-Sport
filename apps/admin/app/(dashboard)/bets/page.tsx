'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, Receipt, Trophy, Dices } from 'lucide-react'
import { adminApi } from '@/lib/api'
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
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  createdAt: string
  user: { username: string }
}

const STATUS_CFG = {
  PENDING: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
  WON:     'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20',
  LOST:    'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
  VOID:    'text-[#4D6B9A] bg-[#4D6B9A]/10 border-[#4D6B9A]/20',
}

const GAME_CFG = {
  VIRTUAL_FOOTBALL: { label: 'Football', icon: Trophy, color: 'text-[#0066FF] bg-[#0066FF]/10 border-[#0066FF]/20' },
  DICE:             { label: 'Dice',     icon: Dices,  color: 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20' },
  HORSE_RACING:     { label: 'Racing',   icon: Trophy, color: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20' },
}

const MOCK_BETS: VirtualBet[] = [
  { id:'1', gameType:'VIRTUAL_FOOTBALL', roundId:'round_abc123', market:'1x2',       pick:'1',        oddsDecimal:'2.10', stakeKobo:'50000',  payoutKobo:'105000', status:'WON',     createdAt: new Date().toISOString(),                     user:{username:'hamid_test'} },
  { id:'2', gameType:'DICE',             roundId:'round_def456', market:'dice',       pick:'OVER:60',  oddsDecimal:'2.35', stakeKobo:'100000', payoutKobo:null,     status:'LOST',    createdAt: new Date(Date.now()-60000).toISOString(),     user:{username:'jane_doe'} },
  { id:'3', gameType:'VIRTUAL_FOOTBALL', roundId:'round_ghi789', market:'btts',       pick:'yes',      oddsDecimal:'1.75', stakeKobo:'200000', payoutKobo:null,     status:'PENDING', createdAt: new Date(Date.now()-120000).toISOString(),   user:{username:'hamid_test'} },
  { id:'4', gameType:'VIRTUAL_FOOTBALL', roundId:'round_jkl012', market:'over_under', pick:'under',    oddsDecimal:'1.95', stakeKobo:'75000',  payoutKobo:null,     status:'LOST',    createdAt: new Date(Date.now()-300000).toISOString(),   user:{username:'john_test'} },
  { id:'5', gameType:'DICE',             roundId:'round_mno345', market:'dice',       pick:'UNDER:40', oddsDecimal:'2.45', stakeKobo:'50000',  payoutKobo:'122500', status:'WON',     createdAt: new Date(Date.now()-600000).toISOString(),   user:{username:'jane_doe'} },
  { id:'6', gameType:'VIRTUAL_FOOTBALL', roundId:'round_pqr678', market:'1x2',       pick:'X',        oddsDecimal:'3.40', stakeKobo:'30000',  payoutKobo:null,     status:'LOST',    createdAt: new Date(Date.now()-900000).toISOString(),   user:{username:'blocked_user'} },
]

function formatNaira(kobo: string | number | null) {
  if (kobo == null) return '—'
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

type StatusFilter = 'ALL' | 'PENDING' | 'WON' | 'LOST'

export default function BetsPage() {
  const [bets, setBets]             = useState<VirtualBet[]>([])
  const [filter, setFilter]         = useState<StatusFilter>('ALL')
  const [gameFilter, setGameFilter] = useState<string>('ALL')
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    setError('')
    try {
      const params = gameFilter !== 'ALL' ? `?gameType=${gameFilter}` : ''
      const res = await adminApi.get<VirtualBet[]>(`/admin/bets/virtual${params}`)
      setBets(res.data?.length ? res.data : MOCK_BETS)
    } catch { setBets(MOCK_BETS) }
    finally { setLoading(false); setRefreshing(false) }
  }, [gameFilter])

  useEffect(() => { load() }, [load])

  const visible    = bets.filter((b) => filter === 'ALL' || b.status === filter)
  const totalStake = visible.reduce((a, b) => a + Number(b.stakeKobo), 0)
  const totalPayout = visible.reduce((a, b) => a + Number(b.payoutKobo ?? 0), 0)
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
          {(['ALL', 'PENDING', 'WON', 'LOST'] as StatusFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all', filter === f ? 'bg-[#0066FF] text-white' : 'text-[#4D6B9A] hover:text-[#E6F1FF]')}>
              {f === 'ALL' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl p-1">
          {([['ALL','All'],['VIRTUAL_FOOTBALL','Football'],['DICE','Dice'],['HORSE_RACING','Racing']] as [string, string][]).map(([g, label]) => (
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
      ) : (
        <div className="space-y-2">
          {visible.map((bet) => {
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
    </div>
  )
}
