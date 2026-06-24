'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Trophy, Dices, Zap, User } from 'lucide-react'
import { cn } from '@qiro/ui'

const tabs = [
  { href: '/sports',           label: 'Lobby',    icon: LayoutGrid },
  { href: '/virtual-football', label: 'Football', icon: Trophy },
  { href: '/dice',             label: 'Dice',     icon: Dices },
  { href: '/horse-racing',     label: 'Racing',   icon: Zap },
  { href: '/account',          label: 'Account',  icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#081226]/95 backdrop-blur-md border-t border-[#1A2B4A] pb-safe">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/sports' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all',
                active ? 'text-[#0066FF]' : 'text-[#4D6B9A]',
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                style={active ? { filter: 'drop-shadow(0 0 6px rgba(0,102,255,0.7))' } : undefined}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
