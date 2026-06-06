'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ArrowDownToLine, Receipt, BarChart2, Settings } from 'lucide-react'
import { cn } from '@qiro/ui'

const navItems = [
  { href: '/(dashboard)/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { href: '/(dashboard)/users',       label: 'Users',       icon: Users },
  { href: '/(dashboard)/bets',        label: 'Bets',        icon: Receipt },
  { href: '/(dashboard)/financials',  label: 'Financials',  icon: BarChart2 },
  { href: '/(dashboard)/config',      label: 'Config',      icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 min-h-screen bg-[#1E293B] border-r border-[#334155] p-4 flex flex-col gap-1">
      <div className="mb-6 px-2">
        <span className="text-sm font-bold text-[#4B6BF1]">Qiro Sport</span>
        <p className="text-[10px] text-[#94A3B8] mt-0.5">Admin Dashboard</p>
      </div>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              active
                ? 'bg-[#4B6BF1]/10 text-[#4B6BF1] font-medium'
                : 'text-[#94A3B8] hover:bg-[#263548] hover:text-[#F1F5F9]',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        )
      })}
    </aside>
  )
}
