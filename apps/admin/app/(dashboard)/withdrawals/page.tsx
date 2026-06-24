'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { adminApi } from '@/lib/api'

interface WithdrawalRequest {
  id: string
  userId: string
  amountKobo: string
  bankCode: string
  accountNumber: string
  accountName: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
  notes: string | null
  createdAt: string
  user: { phone: string; username: string }
}

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'ALL'

const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-[#00C48C]', bg: 'bg-[#00C48C]/10 border-[#00C48C]/20', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10 border-[#EF4444]/20', icon: XCircle },
  PAID:     { label: 'Paid',     color: 'text-[#0066FF]', bg: 'bg-[#0066FF]/10 border-[#0066FF]/20', icon: CheckCircle },
}

function formatNaira(kobo: string | number) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function ActionModal({
  request,
  action,
  onConfirm,
  onCancel,
}: {
  request: WithdrawalRequest
  action: 'approve' | 'reject'
  onConfirm: (notes: string) => Promise<void>
  onCancel: () => void
}) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const isApprove = action === 'approve'

  const handle = async () => {
    setLoading(true)
    await onConfirm(notes)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-base font-bold text-[#E6F1FF] mb-1">
          {isApprove ? 'Approve Withdrawal' : 'Reject Withdrawal'}
        </h3>
        <p className="text-sm text-[#4D6B9A] mb-5">
          {formatNaira(request.amountKobo)} → {request.accountName ?? request.accountNumber} ({request.bankCode})
        </p>
        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={isApprove ? 'Transfer initiated via Paystack…' : 'Reason for rejection…'}
            className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 py-2.5 text-sm text-[#E6F1FF] placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] transition-all resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-10 border border-[#1A2B4A] text-[#4D6B9A] font-semibold rounded-xl hover:bg-[#0F1B3D] transition-all text-sm">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className={`flex-1 h-10 font-bold rounded-xl text-sm transition-all disabled:opacity-60 ${isApprove ? 'bg-[#00C48C] text-white hover:bg-[#00A876]' : 'bg-[#EF4444] text-white hover:bg-[#DC2626]'}`}
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isApprove ? 'Approving…' : 'Rejecting…'}</span>
              : isApprove ? 'Approve & Pay' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [filter, setFilter] = useState<FilterStatus>('PENDING')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [action, setAction] = useState<{ request: WithdrawalRequest; type: 'approve' | 'reject' } | null>(null)

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : ''
      const { data } = await adminApi.get<WithdrawalRequest[]>(`/admin/withdrawals${params}`)
      setRequests(data)
    } catch {
      setError('Failed to load withdrawal requests')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleAction = async (notes: string) => {
    if (!action) return
    try {
      await adminApi.patch(`/admin/withdrawals/${action.request.id}`, {
        status: action.type === 'approve' ? 'APPROVED' : 'REJECTED',
        notes,
      })
      setAction(null)
      fetchRequests(true)
    } catch {
      setError('Action failed. Please try again.')
      setAction(null)
    }
  }

  const FILTERS: FilterStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'ALL']
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#E6F1FF]">Withdrawals</h1>
          <p className="text-sm text-[#4D6B9A] mt-0.5">
            {pendingCount > 0 && filter === 'PENDING' ? `${pendingCount} pending approval` : 'Manage withdrawal requests'}
          </p>
        </div>
        <button
          onClick={() => fetchRequests(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 border border-[#1A2B4A] text-[#4D6B9A] hover:text-[#E6F1FF] hover:border-[#0066FF]/40 rounded-xl text-sm font-semibold transition-all"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
              filter === f
                ? 'bg-[#0066FF]/10 text-[#0066FF] border-[#0066FF]/30'
                : 'border-[#1A2B4A] text-[#4D6B9A] hover:border-[#0066FF]/20 hover:text-[#E6F1FF]'
            }`}
          >
            {f === 'ALL' ? 'All' : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-4 py-3 mb-4 text-sm text-[#EF4444]">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#0F1B3D] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Clock size={36} className="text-[#1A2B4A]" />
          <p className="text-[#4D6B9A] text-sm">No {filter !== 'ALL' ? filter.toLowerCase() : ''} withdrawal requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const cfg = STATUS_CONFIG[req.status]
            const StatusIcon = cfg.icon
            const isPending = req.status === 'PENDING'

            return (
              <div key={req.id} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-4 flex items-center gap-4">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 ${cfg.bg} ${cfg.color}`}>
                  <StatusIcon size={11} />
                  {cfg.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#E6F1FF]">{req.user?.username ?? '—'}</span>
                    <span className="text-xs text-[#4D6B9A]">{req.user?.phone}</span>
                  </div>
                  <div className="text-xs text-[#4D6B9A] mt-0.5">
                    {req.accountName ?? req.accountNumber} · Bank {req.bankCode} · {formatDate(req.createdAt)}
                  </div>
                  {req.notes && <p className="text-xs text-[#4D6B9A] mt-0.5 italic">"{req.notes}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-[#E6F1FF]">{formatNaira(req.amountKobo)}</p>
                  <p className="text-[10px] text-[#4D6B9A] font-mono">{req.id.slice(0, 8)}</p>
                </div>
                {isPending && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setAction({ request: req, type: 'approve' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00C48C]/10 border border-[#00C48C]/20 text-[#00C48C] text-xs font-semibold rounded-lg hover:bg-[#00C48C]/20 transition-all"
                    >
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
                      onClick={() => setAction({ request: req, type: 'reject' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold rounded-lg hover:bg-[#EF4444]/20 transition-all"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {action && (
        <ActionModal
          request={action.request}
          action={action.type}
          onConfirm={handleAction}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  )
}
