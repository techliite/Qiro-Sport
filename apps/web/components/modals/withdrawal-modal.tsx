'use client'

import { useState, useEffect } from 'react'
import { X, ArrowDownToLine, CheckCircle } from 'lucide-react'
import { useWalletStore } from '@/store/wallet.store'
import { api } from '@/lib/api'

interface Bank { name: string; code: string }

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function WithdrawalModal({ open, onClose, onSuccess }: Props) {
  const balance = useWalletStore((s) => s.balanceKobo)

  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [amountNaira, setAmountNaira] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open && banks.length === 0) {
      api.get<Bank[]>('/payments/banks').then((r) => setBanks(r.data)).catch(() => null)
    }
  }, [open, banks.length])

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      setVerifying(true)
      setAccountName('')
      api.post<{ accountName: string }>('/payments/verify-bank', { accountNumber, bankCode })
        .then((r) => setAccountName(r.data.accountName))
        .catch(() => setError('Could not verify account. Check details.'))
        .finally(() => setVerifying(false))
    } else {
      setAccountName('')
    }
  }, [accountNumber, bankCode])

  if (!open) return null

  const handleWithdraw = async () => {
    const amount = Math.round(Number(amountNaira) * 100)
    if (!amount || amount < 50000) { setError('Minimum withdrawal is ₦500'); return }
    if (amount > balance) { setError('Insufficient balance'); return }
    if (!accountName) { setError('Verify your bank account first'); return }

    setError('')
    setLoading(true)
    try {
      await api.post('/payments/withdraw', { amountKobo: amount, bankCode, accountNumber })
      setSuccess(true)
      onSuccess()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSuccess(false)
    setAmountNaira('')
    setBankCode('')
    setAccountNumber('')
    setAccountName('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-sm bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {success ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-[#00C48C]/10 flex items-center justify-center border border-[#00C48C]/30">
              <CheckCircle size={28} className="text-[#00C48C]" />
            </div>
            <div className="text-center">
              <p className="font-bold text-[#E6F1FF] text-lg">Withdrawal Submitted</p>
              <p className="text-sm text-[#4D6B9A] mt-1">Processing within 24 hours to {accountName}</p>
            </div>
            <button onClick={handleClose} className="w-full h-11 bg-[#0066FF] text-white font-bold rounded-xl mt-2">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#4D6B9A]/15 flex items-center justify-center border border-[#4D6B9A]/20">
                  <ArrowDownToLine size={15} className="text-[#4D6B9A]" />
                </div>
                <h2 className="font-bold text-[#E6F1FF]">Withdraw Funds</h2>
              </div>
              <button onClick={handleClose} className="text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Bank select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Bank</label>
                <select
                  value={bankCode}
                  onChange={(e) => { setBankCode(e.target.value); setError('') }}
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 py-3 text-[#E6F1FF] text-sm focus:outline-none focus:border-[#0066FF] transition-all"
                >
                  <option value="">Select bank</option>
                  {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>

              {/* Account number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Account Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="10-digit account number"
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 py-3 text-[#E6F1FF] text-sm placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] transition-all"
                />
                {verifying && <p className="text-xs text-[#4D6B9A]">Verifying account…</p>}
                {accountName && (
                  <p className="text-xs text-[#00C48C] flex items-center gap-1">
                    <CheckCircle size={11} /> {accountName}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] font-bold">₦</span>
                  <input
                    type="number"
                    value={amountNaira}
                    onChange={(e) => { setAmountNaira(e.target.value); setError('') }}
                    placeholder="0.00"
                    className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-8 pr-4 py-3 text-[#E6F1FF] font-bold focus:outline-none focus:border-[#0066FF] transition-all"
                  />
                </div>
                <p className="text-[10px] text-[#4D6B9A]">Available: ₦{(balance / 100).toLocaleString()}</p>
              </div>

              {error && <p className="text-xs text-[#EF4444]">{error}</p>}

              <button
                onClick={handleWithdraw}
                disabled={loading || !accountName || !amountNaira}
                className="w-full h-12 bg-[#0066FF] text-white font-bold rounded-xl shadow-[0_0_16px_rgba(0,102,255,0.3)] hover:bg-[#0052CC] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : `Withdraw ₦${Number(amountNaira || 0).toLocaleString()}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
