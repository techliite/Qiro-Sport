'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ArrowUpRight, ArrowDownLeft, RefreshCw, Trophy, Clock, XCircle, Plus, Minus, X, ChevronDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { formatNaira, cn } from '@qiro/ui'
import { useAuthStore } from '@/store/auth.store'
import { useWalletStore } from '@/store/wallet.store'
import { api } from '@/lib/api'

interface Transaction {
  id: string
  type: string
  amountKobo: string
  runningBalanceKobo: string
  ref: string
  createdAt: string
}

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? ''

const MOCK_TXS: Transaction[] = [
  { id: '1', type: 'DEPOSIT',  amountKobo: '500000',  runningBalanceKobo: '500000',  ref: 'DEP_001', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', type: 'STAKE',    amountKobo: '50000',   runningBalanceKobo: '450000',  ref: 'STK_001', createdAt: new Date(Date.now() - 3000000).toISOString() },
  { id: '3', type: 'WIN',      amountKobo: '105000',  runningBalanceKobo: '555000',  ref: 'WIN_001', createdAt: new Date(Date.now() - 2400000).toISOString() },
  { id: '4', type: 'STAKE',    amountKobo: '100000',  runningBalanceKobo: '455000',  ref: 'STK_002', createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: '5', type: 'WITHDRAW', amountKobo: '200000',  runningBalanceKobo: '255000',  ref: 'WD_001',  createdAt: new Date(Date.now() - 900000).toISOString() },
]


const TX_ICONS: Record<string, React.ReactNode> = {
  DEPOSIT:    <ArrowDownLeft size={14} className="text-[#00C48C]" />,
  WIN:        <Trophy size={14} className="text-[#00D4FF]" />,
  REFUND:     <RefreshCw size={14} className="text-[#00D4FF]" />,
  WITHDRAW:   <ArrowUpRight size={14} className="text-[#EF4444]" />,
  STAKE:      <ArrowUpRight size={14} className="text-[#F59E0B]" />,
  ADJUSTMENT: <RefreshCw size={14} className="text-[#4D6B9A]" />,
}

const TX_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit', WIN: 'Win Payout', REFUND: 'Refund',
  WITHDRAW: 'Withdrawal', STAKE: 'Bet Stake', ADJUSTMENT: 'Adjustment',
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

const isCredit = (type: string) => ['DEPOSIT', 'WIN', 'REFUND'].includes(type)

// ─── Deposit Modal ────────────────────────────────────────────────────────────

interface DepositModalProps {
  user: { id: string; phone: string; username: string } | null
  onClose: () => void
  onSuccess: (newBalance: number) => void
}

const DEPOSIT_PRESETS = [500, 1000, 2000, 5000, 10000, 20000]

function DepositModal({ user, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount]   = useState('')
  const [status, setStatus]   = useState<'idle' | 'loading' | 'verifying' | 'success' | 'error'>('idle')
  const [errMsg, setErrMsg]   = useState('')

  const amountKobo = Math.floor(Number(amount) * 100)
  const valid = amountKobo >= 10000

  const handlePay = async () => {
    if (!valid || !user) return
    setStatus('loading')
    setErrMsg('')

    try {
      const res = await api.post<{ reference: string; accessCode: string }>('/wallet/deposit/initialize', { amountKobo })
      const { reference, accessCode } = res.data

      if (!window.PaystackPop) {
        setStatus('error'); setErrMsg('Payment SDK not loaded. Please refresh.'); return
      }

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: `${user.phone}@users.qirosport.ng`,
        amount: amountKobo,
        ref: reference,
        accessCode,
        onSuccess: async (tx) => {
          setStatus('verifying')
          try {
            const vr = await api.post<{ newBalanceKobo?: number; balanceKobo?: { balanceKobo: number } }>(
              '/wallet/deposit/verify',
              { reference: tx.reference },
            )
            const bal = (vr.data as { newBalanceKobo?: number }).newBalanceKobo
              ?? (vr.data as { balanceKobo?: { balanceKobo: number } }).balanceKobo?.balanceKobo
              ?? 0
            setStatus('success')
            onSuccess(bal)
          } catch {
            setStatus('error'); setErrMsg('Payment received but verification failed. Contact support.')
          }
        },
        onCancel: () => setStatus('idle'),
      })
      handler.openIframe()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to initialize payment'
      setStatus('error'); setErrMsg(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-[#0F1B3D] border border-[#1A2B4A] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#E6F1FF]">Fund Wallet</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
            <X size={13} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-[#00C48C]/15 flex items-center justify-center">
              <CheckCircle size={28} className="text-[#00C48C]" />
            </div>
            <p className="text-base font-bold text-[#E6F1FF]">Deposit Successful!</p>
            <p className="text-sm text-[#4D6B9A]">Your wallet has been credited.</p>
            <button onClick={onClose} className="mt-2 w-full h-11 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl transition-all">Done</button>
          </div>
        ) : (
          <>
            {/* Amount */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-[#4D6B9A] mb-2 block">Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] font-bold">₦</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#081226] border border-[#1A2B4A] text-[#E6F1FF] text-lg font-bold rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:border-[#0066FF] transition-all"
                />
              </div>
              <p className="text-[11px] text-[#4D6B9A] mt-1">Min ₦100 · Max ₦50,000 per transaction</p>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {DEPOSIT_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={cn('h-9 rounded-xl text-xs font-bold border transition-all', Number(amount) === v ? 'bg-[#0066FF]/15 border-[#0066FF]/40 text-[#0066FF]' : 'border-[#1A2B4A] text-[#4D6B9A] hover:text-[#E6F1FF] hover:border-[#0066FF]/30')}
                >
                  ₦{v.toLocaleString()}
                </button>
              ))}
            </div>

            {errMsg && (
              <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2 mb-4 text-xs text-[#EF4444]">
                <AlertCircle size={13} />{errMsg}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!valid || status === 'loading' || status === 'verifying'}
              className="w-full h-12 bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
            >
              {status === 'loading' ? 'Preparing…' : status === 'verifying' ? 'Confirming payment…' : `Pay ${valid ? formatNaira(amountKobo) : '₦0'}`}
            </button>

            <p className="text-center text-[10px] text-[#2A4070] mt-3">Powered by Paystack · SSL secured</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Withdraw Modal ───────────────────────────────────────────────────────────

interface WithdrawModalProps {
  balanceKobo: number
  onClose: () => void
  onSuccess: (newBalance: number) => void
}

interface Bank { name: string; code: string }

function WithdrawModal({ balanceKobo, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount]         = useState('')
  const [bankCode, setBankCode]     = useState('')
  const [accountNo, setAccountNo]   = useState('')
  const [accountName, setAccountName] = useState('')
  const [banks, setBanks]           = useState<Bank[]>([])
  const [verifying, setVerifying]   = useState(false)
  const [status, setStatus]         = useState<'idle' | 'loading' | 'success'>('idle')
  const [errMsg, setErrMsg]         = useState('')

  const amountKobo = Math.floor(Number(amount) * 100)
  const valid = amountKobo >= 50000 && amountKobo <= balanceKobo && !!accountName

  // Fetch bank list once on open
  useEffect(() => {
    api.get<Bank[]>('/payments/banks')
      .then((r) => setBanks(r.data))
      .catch(() => null)
  }, [])

  // Auto-verify account when 10 digits + bank selected
  useEffect(() => {
    if (accountNo.length !== 10 || !bankCode) { setAccountName(''); return }
    setVerifying(true)
    setAccountName('')
    api.post<{ accountName: string }>('/payments/verify-bank', { accountNumber: accountNo, bankCode })
      .then((r) => setAccountName(r.data.accountName))
      .catch(() => setErrMsg('Could not verify account — check details'))
      .finally(() => setVerifying(false))
  }, [accountNo, bankCode])

  const handleSubmit = async () => {
    if (!valid) return
    setStatus('loading'); setErrMsg('')
    try {
      await api.post('/payments/withdraw', { amountKobo, bankCode, accountNumber: accountNo })
      setStatus('success')
      onSuccess(balanceKobo - amountKobo)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Withdrawal request failed'
      setErrMsg(msg)
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-[#0F1B3D] border border-[#1A2B4A] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#E6F1FF]">Withdraw Funds</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#1A2B4A] flex items-center justify-center text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
            <X size={13} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-[#00C48C]/15 flex items-center justify-center">
              <CheckCircle size={28} className="text-[#00C48C]" />
            </div>
            <p className="text-base font-bold text-[#E6F1FF]">Request Submitted</p>
            <p className="text-sm text-[#4D6B9A] text-center">Your withdrawal is being processed. Funds arrive within 24 hours.</p>
            <button onClick={onClose} className="mt-2 w-full h-11 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl transition-all">Done</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-[#4D6B9A] mb-4">Available: <span className="text-[#00C48C] font-bold">{formatNaira(balanceKobo)}</span></p>

            <div className="space-y-3 mb-5">
              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-[#4D6B9A] mb-1.5 block">Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] font-bold">₦</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setErrMsg('') }}
                    placeholder="0"
                    className="w-full bg-[#081226] border border-[#1A2B4A] text-[#E6F1FF] font-bold rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#0066FF] transition-all"
                  />
                </div>
                <p className="text-[11px] text-[#4D6B9A] mt-1">Min ₦500</p>
              </div>

              {/* Bank */}
              <div>
                <label className="text-xs font-semibold text-[#4D6B9A] mb-1.5 block">Bank</label>
                <div className="relative">
                  <select
                    value={bankCode}
                    onChange={(e) => { setBankCode(e.target.value); setErrMsg('') }}
                    className="w-full bg-[#081226] border border-[#1A2B4A] text-[#E6F1FF] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF] transition-all appearance-none"
                  >
                    <option value="">Select bank…</option>
                    {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4D6B9A] pointer-events-none" />
                </div>
              </div>

              {/* Account number */}
              <div>
                <label className="text-xs font-semibold text-[#4D6B9A] mb-1.5 block">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNo}
                  onChange={(e) => { setAccountNo(e.target.value.replace(/\D/g, '').slice(0, 10)); setErrMsg('') }}
                  placeholder="0123456789"
                  className="w-full bg-[#081226] border border-[#1A2B4A] text-[#E6F1FF] font-mono rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:border-[#0066FF] transition-all"
                />
                {verifying && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[#4D6B9A] mt-1">
                    <Loader2 size={10} className="animate-spin" /> Verifying account…
                  </p>
                )}
                {accountName && !verifying && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[#00C48C] mt-1">
                    <CheckCircle size={10} /> {accountName}
                  </p>
                )}
              </div>
            </div>

            {errMsg && (
              <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2 mb-4 text-xs text-[#EF4444]">
                <AlertCircle size={13} />{errMsg}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!valid || status === 'loading' || verifying}
              className="w-full h-12 bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
            >
              {status === 'loading' ? 'Submitting…' : `Withdraw ${amountKobo >= 50000 ? formatNaira(amountKobo) : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── My Bets ─────────────────────────────────────────────────────────────────

interface VirtualBet {
  id: string
  gameType: 'DICE' | 'VIRTUAL_FOOTBALL' | 'HORSE_RACING'
  market: string
  pick: string
  oddsDecimal: number
  stakeKobo: number
  payoutKobo: number | null
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  createdAt: string
}

const GAME_LABELS: Record<string, string> = {
  DICE: 'Dice',
  VIRTUAL_FOOTBALL: 'Football',
  HORSE_RACING: 'Horse Racing',
}

const MOCK_BETS: VirtualBet[] = [
  { id: '1', gameType: 'VIRTUAL_FOOTBALL', market: '1x2', pick: '1', oddsDecimal: 1.85, stakeKobo: 50000, payoutKobo: 92500, status: 'WON', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', gameType: 'DICE', market: 'dice', pick: 'OVER:50', oddsDecimal: 1.96, stakeKobo: 20000, payoutKobo: 0, status: 'LOST', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: '3', gameType: 'HORSE_RACING', market: 'win', pick: '3', oddsDecimal: 4.20, stakeKobo: 30000, payoutKobo: null, status: 'PENDING', createdAt: new Date(Date.now() - 1800000).toISOString() },
]

function BetRow({ bet }: { bet: VirtualBet }) {
  const statusColor = bet.status === 'WON' ? 'text-[#00C48C]' : bet.status === 'LOST' ? 'text-[#EF4444]' : bet.status === 'PENDING' ? 'text-[#F59E0B]' : 'text-[#4D6B9A]'
  const statusBg    = bet.status === 'WON' ? 'bg-[#00C48C]/10' : bet.status === 'LOST' ? 'bg-[#EF4444]/10' : bet.status === 'PENDING' ? 'bg-[#F59E0B]/10' : 'bg-[#1A2B4A]'

  return (
    <div className="flex items-center gap-3 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-[#E6F1FF]">{GAME_LABELS[bet.gameType]}</span>
          <span className="text-[10px] text-[#4D6B9A]">{bet.market} · {bet.pick}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#4D6B9A]">Stake: {formatNaira(bet.stakeKobo)}</span>
          <span className="text-[10px] text-[#4D6B9A]">@ {bet.oddsDecimal.toFixed(2)}</span>
        </div>
        <p className="text-[10px] text-[#4D6B9A] mt-0.5">{formatTime(bet.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        {bet.status === 'WON' && bet.payoutKobo ? (
          <p className="text-sm font-bold text-[#00C48C] font-mono">+{formatNaira(bet.payoutKobo)}</p>
        ) : bet.status === 'LOST' ? (
          <p className="text-sm font-bold text-[#EF4444] font-mono">−{formatNaira(bet.stakeKobo)}</p>
        ) : null}
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block', statusColor, statusBg)}>
          {bet.status}
        </span>
      </div>
    </div>
  )
}

// ─── Account Page ─────────────────────────────────────────────────────────────

type Tab = 'transactions' | 'bets'

export default function AccountPage() {
  const router    = useRouter()
  const user      = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const balance   = useWalletStore((s) => s.balanceKobo)
  const setBalance = useWalletStore((s) => s.setBalance)

  const [tab, setTab] = useState<Tab>('transactions')

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txPage, setTxPage] = useState(1)
  const [txTotal, setTxTotal] = useState(0)
  const [txLoading, setTxLoading] = useState(true)

  // Bets state
  const [bets, setBets] = useState<VirtualBet[]>([])
  const [betPage, setBetPage] = useState(1)
  const [betTotal, setBetTotal] = useState(0)
  const [betLoading, setBetLoading] = useState(false)

  const [showDeposit, setShowDeposit]   = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const LIMIT = 20

  const loadBalance = useCallback(() => {
    api.get<{ balanceKobo: number }>('/wallet/balance')
      .then((r) => setBalance(r.data.balanceKobo))
      .catch(() => null)
  }, [setBalance])

  useEffect(() => { loadBalance() }, [loadBalance])

  useEffect(() => {
    setTxLoading(true)
    api.get<{ transactions: Transaction[]; total: number }>(`/wallet/transactions?page=${txPage}&limit=${LIMIT}`)
      .then((r) => {
        setTransactions(r.data.transactions?.length ? r.data.transactions : MOCK_TXS)
        setTxTotal(r.data.total || MOCK_TXS.length)
      })
      .catch(() => { setTransactions(MOCK_TXS); setTxTotal(MOCK_TXS.length) })
      .finally(() => setTxLoading(false))
  }, [txPage])

  useEffect(() => {
    if (tab !== 'bets') return
    setBetLoading(true)
    api.get<{ bets: VirtualBet[]; total: number }>(`/virtual/my-bets?page=${betPage}&limit=${LIMIT}`)
      .then((r) => {
        setBets(r.data.bets?.length ? r.data.bets : MOCK_BETS)
        setBetTotal(r.data.total || MOCK_BETS.length)
      })
      .catch(() => { setBets(MOCK_BETS); setBetTotal(MOCK_BETS.length) })
      .finally(() => setBetLoading(false))
  }, [tab, betPage])

  const handleDepositSuccess = (newBalance: number) => {
    setBalance(newBalance)
    api.get<{ transactions: Transaction[]; total: number }>(`/wallet/transactions?page=1&limit=${LIMIT}`)
      .then((r) => { setTransactions(r.data.transactions); setTxTotal(r.data.total); setTxPage(1) })
      .catch(() => null)
  }

  const handleWithdrawSuccess = (newBalance: number) => {
    setBalance(newBalance)
    api.get<{ transactions: Transaction[]; total: number }>(`/wallet/transactions?page=1&limit=${LIMIT}`)
      .then((r) => { setTransactions(r.data.transactions); setTxTotal(r.data.total); setTxPage(1) })
      .catch(() => null)
  }

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    clearAuth()
    router.replace('/login')
  }

  return (
    <div className="flex flex-col pb-24">
      {/* Wallet card */}
      <div className="mx-4 mt-4 rounded-2xl bg-linear-to-br from-[#0F1B3D] via-[#081226] to-[#070B1A] border border-[#1A2B4A] p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#0066FF]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00D4FF]/5 rounded-full blur-3xl pointer-events-none" />

        <p className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider mb-1">Main Wallet</p>
        <p className="font-mono text-3xl font-extrabold text-[#E6F1FF] mb-0.5" data-balance>
          {formatNaira(balance)}
        </p>
        <p className="text-xs text-[#4D6B9A] mb-5">@{user?.username ?? '—'} · {user?.phone ?? ''}</p>

        <div className="flex gap-3">
          <button
            onClick={() => setShowDeposit(true)}
            className="flex-1 flex items-center justify-center gap-2 h-10 bg-[#0066FF] hover:bg-[#0052CC] active:scale-[0.97] text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_16px_rgba(0,102,255,0.35)]"
          >
            <Plus size={15} /> Deposit
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="flex-1 flex items-center justify-center gap-2 h-10 border border-[#1A2B4A] hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 active:scale-[0.97] text-[#E6F1FF] font-bold rounded-xl text-sm transition-all"
          >
            <Minus size={15} /> Withdraw
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-5 flex gap-1 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl p-1">
        {(['transactions', 'bets'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 h-8 rounded-lg text-xs font-bold transition-all',
              tab === t ? 'bg-[#0066FF] text-white' : 'text-[#4D6B9A] hover:text-[#E6F1FF]',
            )}
          >
            {t === 'transactions' ? 'Transactions' : 'My Bets'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-3 px-4">
        {tab === 'transactions' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#E6F1FF]">Transaction History</h3>
              <span className="text-xs text-[#4D6B9A]">{txTotal} total</span>
            </div>

            {txLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-[#0F1B3D] rounded-xl animate-pulse" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <Clock size={32} className="text-[#1A2B4A]" />
                <p className="text-sm text-[#4D6B9A]">No transactions yet</p>
                <button onClick={() => setShowDeposit(true)} className="mt-2 text-xs text-[#0066FF] font-semibold hover:text-[#00D4FF] transition-colors">Make your first deposit →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#081226] flex items-center justify-center shrink-0">
                      {TX_ICONS[tx.type] ?? <XCircle size={14} className="text-[#4D6B9A]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#E6F1FF]">{TX_LABELS[tx.type] ?? tx.type}</p>
                      <p className="text-[10px] text-[#4D6B9A] truncate">{formatTime(tx.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-bold font-mono', isCredit(tx.type) ? 'text-[#00C48C]' : 'text-[#EF4444]')}>
                        {isCredit(tx.type) ? '+' : '−'}{formatNaira(Number(tx.amountKobo))}
                      </p>
                      <p className="text-[10px] text-[#4D6B9A] font-mono">{formatNaira(Number(tx.runningBalanceKobo))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {txTotal > LIMIT && (
              <div className="flex items-center justify-between mt-4">
                <button disabled={txPage === 1} onClick={() => setTxPage((p) => p - 1)} className="text-sm text-[#0066FF] disabled:text-[#4D6B9A] font-semibold">← Prev</button>
                <span className="text-xs text-[#4D6B9A]">Page {txPage} of {Math.ceil(txTotal / LIMIT)}</span>
                <button disabled={txPage * LIMIT >= txTotal} onClick={() => setTxPage((p) => p + 1)} className="text-sm text-[#0066FF] disabled:text-[#4D6B9A] font-semibold">Next →</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#E6F1FF]">Bet History</h3>
              <span className="text-xs text-[#4D6B9A]">{betTotal} total</span>
            </div>

            {betLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-[#0F1B3D] rounded-xl animate-pulse" />)}
              </div>
            ) : bets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <Trophy size={32} className="text-[#1A2B4A]" />
                <p className="text-sm text-[#4D6B9A]">No bets placed yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bets.map((bet) => <BetRow key={bet.id} bet={bet} />)}
              </div>
            )}

            {betTotal > LIMIT && (
              <div className="flex items-center justify-between mt-4">
                <button disabled={betPage === 1} onClick={() => setBetPage((p) => p - 1)} className="text-sm text-[#0066FF] disabled:text-[#4D6B9A] font-semibold">← Prev</button>
                <span className="text-xs text-[#4D6B9A]">Page {betPage} of {Math.ceil(betTotal / LIMIT)}</span>
                <button disabled={betPage * LIMIT >= betTotal} onClick={() => setBetPage((p) => p + 1)} className="text-sm text-[#0066FF] disabled:text-[#4D6B9A] font-semibold">Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Logout */}
      <div className="mx-4 mt-8">
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 h-12 border border-[#1A2B4A] text-[#EF4444] font-semibold rounded-xl hover:bg-[#EF4444]/5 hover:border-[#EF4444]/30 active:scale-[0.98] transition-all">
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Modals */}
      {showDeposit && (
        <DepositModal
          user={user}
          onClose={() => setShowDeposit(false)}
          onSuccess={(bal) => { handleDepositSuccess(bal); setShowDeposit(false) }}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          balanceKobo={balance}
          onClose={() => setShowWithdraw(false)}
          onSuccess={(bal) => { handleWithdrawSuccess(bal); setShowWithdraw(false) }}
        />
      )}
    </div>
  )
}
