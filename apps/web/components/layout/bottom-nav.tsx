'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Zap, Horse, Dice6, User } from 'lucide-react'
import { cn } from '@qiro/ui'

const tabs = [
  { href: '/(main)/sports',           label: 'Sports',   icon: Home },
  { href: '/(main)/virtual-football', label: 'Virtual',  icon: Zap },
  { href: '/(main)/horse-racing',     label: 'Racing',   icon: Horse },
  { href: '/(main)/dice',             label: 'Dice',     icon: Dice6 },
  { href: '/(main)/account',          label: 'Account',  icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1E293B] border-t border-[#334155] pb-safe">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
                active ? 'text-[#4B6BF1]' : 'text-[#94A3B8]',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
