'use client'

import { useEffect, useState } from 'react'
import { Plus, ArrowDownToLine, Zap, RefreshCw } from 'lucide-react'
import { formatNaira } from '@qiro/ui'
import { useWalletStore } from '@/store/wallet.store'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { DepositModal } from '@/components/modals/deposit-modal'
import { WithdrawalModal } from '@/components/modals/withdrawal-modal'
import { useUserSocket } from '@/hooks/useUserSocket'

export function BalanceBanner() {
  const balance = useWalletStore((s) => s.balanceKobo)
  const setBalance = useWalletStore((s) => s.setBalance)
  const username = useAuthStore((s) => s.user?.username)
  const userId   = useAuthStore((s) => s.user?.id)

  useUserSocket(userId)

  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBalance = async () => {
    try {
      const { data } = await api.get<{ balanceKobo: number }>('/wallet/balance')
      setBalance(data.balanceKobo)
    } catch { /* handled by api interceptor */ }
  }

  useEffect(() => {
    fetchBalance()
    // Auto-refresh balance every 60s
    const interval = setInterval(fetchBalance, 60_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchBalance()
    setRefreshing(false)
  }

  return (
    <>
      <header className="bg-[#081226]/95 backdrop-blur-md border-b border-[#1A2B4A] px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#0066FF] flex items-center justify-center shadow-[0_0_12px_rgba(0,102,255,0.4)]">
              <Zap size={13} className="text-white" fill="white" />
            </div>
            <span className="text-sm font-extrabold text-[#E6F1FF] tracking-tight hidden xs:block">
              {username ? `Hi, ${username}` : 'Qiro Sport'}
            </span>
          </div>

          {/* Balance + actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 text-[#4D6B9A] hover:text-[#0066FF] transition-colors"
              title="Refresh balance"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <div className="flex items-center gap-1.5 bg-[#0F1B3D] border border-[#1A2B4A] rounded-lg px-3 py-1.5">
              <span className="font-mono text-sm font-bold text-[#E6F1FF]" data-balance>
                {formatNaira(balance)}
              </span>
            </div>

            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1.5 bg-[#0066FF] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-[0_0_12px_rgba(0,102,255,0.3)] hover:shadow-[0_0_18px_rgba(0,102,255,0.5)] hover:bg-[#0052CC] active:scale-95 transition-all"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Deposit</span>
            </button>

            <button
              onClick={() => setWithdrawOpen(true)}
              className="flex items-center gap-1.5 border border-[#1A2B4A] text-[#E6F1FF] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#0F1B3D] hover:border-[#0066FF]/40 active:scale-95 transition-all"
            >
              <ArrowDownToLine size={13} />
              <span className="hidden sm:inline">Withdraw</span>
            </button>
          </div>
        </div>
      </header>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onSuccess={fetchBalance}
      />
      <WithdrawalModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={fetchBalance}
      />
    </>
  )
}
