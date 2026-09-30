'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ArrowDownToLine, Receipt, BarChart2, Settings, LogOut } from 'lucide-react'
import { cn } from '@qiro/ui'
import { adminApi, ADMIN_TOKEN_KEY } from '@/lib/api'

async function logout() {
  try {
    await adminApi.post('/admin/auth/logout')
  } finally {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    window.location.href = '/login'
  }
}

const navItems = [
  { href: '/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { href: '/users',       label: 'Users',       icon: Users },
  { href: '/bets',        label: 'Bets',        icon: Receipt },
  { href: '/financials',  label: 'Financials',  icon: BarChart2 },
  { href: '/config',      label: 'Config',      icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-52 min-h-screen bg-[#081226] border-r border-[#1A2B4A] p-4 flex-col gap-1 shrink-0">
      <div className="mb-6 px-2">
        <span className="text-sm font-bold text-[#0066FF]" style={{ textShadow: '0 0 12px rgba(0,102,255,0.5)' }}>
          Qiro Sport
        </span>
        <p className="text-[10px] text-[#4D6B9A] mt-0.5">Admin Dashboard</p>
      </div>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
              active
                ? 'bg-[#0066FF]/10 text-[#0066FF] font-medium border border-[#0066FF]/20'
                : 'text-[#4D6B9A] hover:bg-[#0F1B3D] hover:text-[#E6F1FF]',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        )
      })}
      <button
        onClick={logout}
        className="mt-auto flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#4D6B9A] hover:bg-[#0F1B3D] hover:text-[#EF4444] transition-all"
      >
        <LogOut size={16} />
        Log out
      </button>
    </aside>
  )
}

export function MobileAdminNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#081226] border-t border-[#1A2B4A] flex">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors',
              active ? 'text-[#0066FF]' : 'text-[#4D6B9A]',
            )}
          >
            <Icon size={18} />
            <span className="text-[9px] font-semibold leading-none">{label}</span>
          </Link>
        )
      })}
      <button
        onClick={logout}
        className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[#4D6B9A] transition-colors"
      >
        <LogOut size={18} />
        <span className="text-[9px] font-semibold leading-none">Log out</span>
      </button>
    </nav>
  )
}
