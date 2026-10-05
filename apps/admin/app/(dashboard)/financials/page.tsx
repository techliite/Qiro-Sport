'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Users, Activity } from 'lucide-react'
import { adminApi, getApiError } from '@/lib/api'
import { cn } from '@qiro/ui'

interface DailyFinancials {
  date: string
  deposits:    { totalKobo: number; count: number }
  withdrawals: { totalKobo: number; count: number }
  stakes:      { totalKobo: number; count: number }
  wins:        { totalKobo: number; count: number }
  ggrKobo:     number
  totalUsers:  number
  newUsers:    number
}

function formatNaira(kobo: number) {
  const abs = Math.abs(kobo) / 100
  if (abs >= 1_000_000) return (kobo < 0 ? '-' : '') + '₦' + (abs / 1_000_000).toFixed(2) + 'M'
  if (abs >= 1_000)    return (kobo < 0 ? '-' : '') + '₦' + (abs / 1_000).toFixed(1) + 'K'
  return (kobo < 0 ? '-' : '') + '₦' + abs.toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconColor: string
  highlight?: boolean
  positive?: boolean
}

function KpiCard({ label, value, sub, icon: Icon, iconColor, highlight, positive }: KpiCardProps) {
  return (
    <div className={cn('rounded-2xl border p-4 flex flex-col gap-3', highlight ? 'border-[#0066FF]/30 bg-[#0066FF]/5' : 'border-[#1A2B4A] bg-[#0F1B3D]')}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-[#4D6B9A]">{label}</span>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', iconColor)}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className={cn('text-2xl font-black tabular-nums', positive === true ? 'text-[#00C48C]' : positive === false ? 'text-[#EF4444]' : 'text-[#E6F1FF]')}>{value}</p>
        {sub && <p className="text-[11px] text-[#4D6B9A] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function FinancialsPage() {
  const [date, setDate]         = useState(todayIso())
  const [data, setData]         = useState<DailyFinancials | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState('')

  const load = useCallback(async (d: string, silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const res = await adminApi.get<DailyFinancials>(`/admin/financials/daily?date=${d}`)
      setData(res.data ?? null)
      setError('')
    } catch (err) { setData(null); setError(getApiError(err, 'Could not load financials')) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  const margin = data ? (data.stakes.totalKobo > 0 ? (data.ggrKobo / data.stakes.totalKobo) * 100 : 0) : 0

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#E6F1FF]">Financials</h1>
          <p className="text-sm text-[#4D6B9A] mt-0.5">Daily revenue snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#0F1B3D] border border-[#1A2B4A] text-[#E6F1FF] text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#0066FF] transition-all"
          />
          <button onClick={() => load(date, true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 border border-[#1A2B4A] text-[#4D6B9A] hover:text-[#E6F1FF] hover:border-[#0066FF]/40 rounded-xl text-sm font-semibold transition-all">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-[#0F1B3D] rounded-2xl animate-pulse" />)}</div>
      ) : error ? (
        <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-4 py-3 text-sm text-[#EF4444]">
          <AlertCircle size={15} />{error}
        </div>
      ) : !data ? null : (
        <>
          {/* GGR highlight */}
          <div className={cn('rounded-2xl border p-5 mb-4 flex items-center gap-4', data.ggrKobo >= 0 ? 'border-[#00C48C]/25 bg-[#00C48C]/5' : 'border-[#EF4444]/25 bg-[#EF4444]/5')}>
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', data.ggrKobo >= 0 ? 'bg-[#00C48C]/15' : 'bg-[#EF4444]/15')}>
              {data.ggrKobo >= 0 ? <TrendingUp size={22} className="text-[#00C48C]" /> : <TrendingDown size={22} className="text-[#EF4444]" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#4D6B9A] mb-1">Gross Gaming Revenue (GGR)</p>
              <p className={cn('text-3xl font-black tabular-nums', data.ggrKobo >= 0 ? 'text-[#00C48C]' : 'text-[#EF4444]')}>{formatNaira(data.ggrKobo)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#4D6B9A]">Margin</p>
              <p className={cn('text-lg font-black', data.ggrKobo >= 0 ? 'text-[#00C48C]' : 'text-[#EF4444]')}>{margin.toFixed(1)}%</p>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              label="Deposits"
              value={formatNaira(data.deposits.totalKobo)}
              sub={`${data.deposits.count} transactions`}
              icon={ArrowDownCircle}
              iconColor="bg-[#00C48C]/15 text-[#00C48C]"
              positive={true}
            />
            <KpiCard
              label="Withdrawals"
              value={formatNaira(data.withdrawals.totalKobo)}
              sub={`${data.withdrawals.count} transactions`}
              icon={ArrowUpCircle}
              iconColor="bg-[#EF4444]/15 text-[#EF4444]"
            />
            <KpiCard
              label="Total Stakes"
              value={formatNaira(data.stakes.totalKobo)}
              sub={`${data.stakes.count} bets placed`}
              icon={Activity}
              iconColor="bg-[#0066FF]/15 text-[#0066FF]"
              highlight
            />
            <KpiCard
              label="Total Payouts"
              value={formatNaira(data.wins.totalKobo)}
              sub={`${data.wins.count} winning bets`}
              icon={TrendingUp}
              iconColor="bg-[#F59E0B]/15 text-[#F59E0B]"
            />
            <KpiCard
              label="Total Users"
              value={data.totalUsers.toLocaleString()}
              sub={`+${data.newUsers} new today`}
              icon={Users}
              iconColor="bg-[#00D4FF]/15 text-[#00D4FF]"
            />
            <div className="rounded-2xl border border-[#1A2B4A] bg-[#0F1B3D] p-4 flex flex-col gap-2">
              <span className="text-xs font-semibold text-[#4D6B9A]">Date</span>
              <p className="text-base font-bold text-[#E6F1FF]">
                {new Intl.DateTimeFormat('en-NG', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date))}
              </p>
              <button onClick={() => setDate(todayIso())} className="self-start text-[10px] font-semibold text-[#0066FF] hover:text-[#00D4FF] transition-colors mt-auto">
                ← Back to today
              </button>
            </div>
          </div>

          {/* Note */}
          <p className="text-[11px] text-[#2A4070] mt-4">GGR = Total Stakes − Total Payouts. Figures reflect completed bets settled within the selected day.</p>
        </>
      )}
    </div>
  )
}
