'use client'

import { formatNaira } from '@qiro/ui'
import { useWalletStore } from '@/store/wallet.store'

export function BalanceBanner() {
  const balance = useWalletStore((s) => s.balanceKobo)

  return (
    <header className="bg-[#1E293B] border-b border-[#334155] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <span className="text-sm font-semibold text-[#94A3B8]">Qiro Sport</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-[#F1F5F9]" data-balance>
          {formatNaira(balance)}
        </span>
        <button className="bg-[#4B6BF1] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
          Deposit
        </button>
      </div>
    </header>
  )
}
