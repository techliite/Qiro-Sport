'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Trophy, Dices, Zap, ChevronRight, TrendingUp, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@qiro/ui'
import { HighlightReel } from '@/components/lobby/highlight-reel'
import { PromoBanner } from '@/components/lobby/promo-banner'

interface RecentResult {
  id: string
  league: 'A' | 'B'
  homeTeam: { name: string }
  awayTeam: { name: string }
  homeScore: number
  awayScore: number
}

const GAMES = [
  {
    id: 'virtual-football',
    href: '/virtual-football',
    label: 'Virtual Football',
    tag: 'LIVE',
    tagColor: 'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20',
    description: 'New match every 5 minutes. Pick winners, scorelines & more.',
    icon: Trophy,
    gradient: 'from-[#0066FF]/20 to-[#00D4FF]/5',
    glowColor: 'rgba(0,102,255,0.3)',
    active: true,
  },
  {
    id: 'dice',
    href: '/dice',
    label: 'Dice',
    tag: 'LIVE',
    tagColor: 'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20',
    description: 'Pick a number. Roll over or under. Instant payouts up to 49x.',
    icon: Dices,
    gradient: 'from-[#00D4FF]/20 to-[#0066FF]/5',
    glowColor: 'rgba(0,212,255,0.25)',
    active: true,
  },
  {
    id: 'horse-racing',
    href: '/horse-racing',
    label: 'Horse Racing',
    tag: 'LIVE',
    tagColor: 'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20',
    description: 'Virtual racing with 8 horses. Race every 3 minutes. Win & place markets.',
    icon: Zap,
    gradient: 'from-[#F59E0B]/10 to-transparent',
    glowColor: 'rgba(245,158,11,0.2)',
    active: true,
  },
]

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-4 py-2 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl">
      <span className="text-base sm:text-xl font-black text-[#E6F1FF] tabular-nums">{value}</span>
      <span className="text-[10px] text-[#4D6B9A] font-medium">{label}</span>
    </div>
  )
}

export default function SportsLobbyPage() {
  const [results, setResults] = useState<RecentResult[]>([])

  useEffect(() => {
    api.get<RecentResult[]>('/virtual/football/results?limit=6')
      .then((r) => setResults(r.data))
      .catch(() => {
        setResults([
          { id: '1', league: 'A', homeTeam: { name: 'Madrid FC' }, awayTeam: { name: 'Bayern SC' }, homeScore: 2, awayScore: 1 },
          { id: '2', league: 'B', homeTeam: { name: 'Porto Athletic' }, awayTeam: { name: 'Lisbon FC' }, homeScore: 0, awayScore: 2 },
          { id: '3', league: 'A', homeTeam: { name: 'Paris City' }, awayTeam: { name: 'Ajax SC' }, homeScore: 3, awayScore: 3 },
          { id: '4', league: 'B', homeTeam: { name: 'Vienna SC' }, awayTeam: { name: 'Bruges City' }, homeScore: 1, awayScore: 0 },
        ])
      })
  }, [])

  return (
    <div className="flex flex-col min-h-full pb-6">
      {/* Hero — full-width promo carousel */}
      <div className="px-4 pt-4">
        <PromoBanner />
      </div>

      {/* Quick stats + live highlight reel */}
      <div className="relative px-4 pt-4 pb-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#0066FF]/10 rounded-full blur-3xl" />
        </div>
        <div className="relative flex items-stretch gap-3">
          <div className="flex-1 min-w-0 grid grid-rows-3 sm:grid-rows-1 sm:grid-cols-3 gap-2 sm:self-center">
            <StatPill label="Games" value="3 Live" />
            <StatPill label="Min Stake" value="₦100" />
            <StatPill label="Max Win" value="₦1M" />
          </div>
          <HighlightReel className="w-[172px] sm:w-[280px] lg:w-[420px] shrink-0" />
        </div>
      </div>

      {/* Games */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-bold text-[#4D6B9A] uppercase tracking-wider">Games</h2>
          <div className="flex items-center gap-1 text-[10px] text-[#00C48C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C48C] animate-pulse" />
            3 live
          </div>
        </div>

        {GAMES.map(({ id, href, label, tag, tagColor, description, icon: Icon, gradient, glowColor, active }) => (
          <Link
            key={id}
            href={href}
            className={cn(
              'group relative block rounded-2xl border overflow-hidden transition-all duration-200',
              active
                ? 'border-[#1A2B4A] hover:border-[#0066FF]/40 hover:shadow-[0_0_24px_var(--glow)]'
                : 'border-[#1A2B4A] opacity-75 cursor-default pointer-events-none',
            )}
            style={{ '--glow': glowColor } as React.CSSProperties}
          >
            <div className={cn('absolute inset-0 bg-linear-to-br', gradient)} />
            <div className="relative flex items-center gap-4 px-4 py-4">
              <div className="w-12 h-12 rounded-xl bg-[#081226] border border-[#1A2B4A] flex items-center justify-center shrink-0 group-hover:border-[#0066FF]/30 transition-colors">
                <Icon size={22} className="text-[#0066FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-[#E6F1FF]">{label}</span>
                  <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-wide', tagColor)}>
                    {tag}
                  </span>
                </div>
                <p className="text-xs text-[#4D6B9A] leading-relaxed">{description}</p>
              </div>
              {active && (
                <ChevronRight
                  size={16}
                  className="text-[#1A2B4A] group-hover:text-[#0066FF] group-hover:translate-x-0.5 transition-all shrink-0"
                />
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Recent VF Results */}
      {results.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-[#4D6B9A]" />
            <h2 className="text-[10px] font-bold text-[#4D6B9A] uppercase tracking-wider">Recent Results</h2>
          </div>
          <div className="space-y-1.5">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl">
                <Trophy size={10} className="text-[#0066FF] shrink-0" />
                <span className="text-[10px] text-[#4D6B9A] shrink-0">L{r.league}</span>
                <span className="text-xs text-[#4D6B9A] flex-1 truncate text-right">{r.homeTeam.name}</span>
                <span className="text-xs font-black text-[#E6F1FF] tabular-nums px-2 py-0.5 bg-[#081226] rounded-md shrink-0 min-w-[44px] text-center">
                  {r.homeScore} – {r.awayScore}
                </span>
                <span className="text-xs text-[#4D6B9A] flex-1 truncate">{r.awayTeam.name}</span>
              </div>
            ))}
          </div>
          <Link href="/virtual-football" className="flex items-center justify-center gap-1.5 mt-3 text-xs text-[#0066FF] font-semibold hover:text-[#00D4FF] transition-colors">
            <TrendingUp size={13} /> View all matches
          </Link>
        </div>
      )}
    </div>
  )
}
