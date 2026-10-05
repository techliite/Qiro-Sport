'use client'

import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { depositWithPaystack } from '@/lib/paystack'

const PRESETS = [500_00, 1000_00, 2000_00, 5000_00] // kobo

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DepositModal({ open, onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const [amountNaira, setAmountNaira] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleDeposit = async () => {
    const amount = Math.round(Number(amountNaira) * 100)
    if (!amount || amount < 10000) { setError('Minimum deposit is ₦100'); return }
    if (!user) return

    setError('')
    setLoading(true)

    try {
      const result = await depositWithPaystack(amount)
      if (result.status === 'success') {
        onClose()
        onSuccess()
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err as Error)?.message ?? 'Failed to initiate deposit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0066FF]/15 flex items-center justify-center border border-[#0066FF]/20">
              <Zap size={15} className="text-[#0066FF]" />
            </div>
            <h2 className="font-bold text-[#E6F1FF]">Deposit Funds</h2>
          </div>
          <button onClick={onClose} className="text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Amount input */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Amount (₦)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] font-bold">₦</span>
            <input
              type="number"
              value={amountNaira}
              onChange={(e) => { setAmountNaira(e.target.value); setError('') }}
              placeholder="0.00"
              className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-8 pr-4 py-3 text-[#E6F1FF] text-lg font-bold focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all"
            />
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmountNaira(String(p / 100))}
              className="bg-[#081226] border border-[#1A2B4A] rounded-lg py-2 text-xs font-semibold text-[#4D6B9A] hover:border-[#0066FF]/40 hover:text-[#0066FF] transition-all"
            >
              ₦{(p / 100).toLocaleString()}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-[#EF4444] mb-4">{error}</p>}

        <button
          onClick={handleDeposit}
          disabled={loading || !amountNaira}
          className="w-full h-12 bg-[#0066FF] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,102,255,0.4)] hover:shadow-[0_0_30px_rgba(0,102,255,0.6)] hover:bg-[#0052CC] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Opening payment…
            </span>
          ) : `Deposit ₦${Number(amountNaira || 0).toLocaleString()}`}
        </button>

        <p className="text-center text-[10px] text-[#4D6B9A] mt-3">
          Secured by Paystack · All deposits reflect within 2 minutes
        </p>
      </div>
    </div>
  )
}
