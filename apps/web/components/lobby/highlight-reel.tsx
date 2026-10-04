'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { Trophy, Dices, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@qiro/ui'

// ─── Data ─────────────────────────────────────────────────────────────────────

const SLIDE_MS = 4800
const EXAMPLE_STAKE = 1_000 // ₦ — returns shown are stake × the odds on screen

interface VFRound {
  league: 'A' | 'B'
  homeTeam: { name: string }
  awayTeam: { name: string }
  odds: { '1x2': { '1': number; X: number; '2': number } }
}

interface Race {
  raceNumber: number
  horses: { id: number; name: string; winOdds?: number }[]
}

// Shown until (or if) the live endpoints respond
const FALLBACK_ROUND: VFRound = {
  league: 'A',
  homeTeam: { name: 'Madrid FC' },
  awayTeam: { name: 'Bayern SC' },
  odds: { '1x2': { '1': 2.1, X: 3.4, '2': 3.2 } },
}
const FALLBACK_RACE: Race = {
  raceNumber: 14,
  horses: [
    { id: 1, name: 'Thunder Bolt', winOdds: 2.4 },
    { id: 4, name: 'Abuja Pride', winOdds: 3.1 },
    { id: 9, name: 'Desert Wind', winOdds: 7.5 },
  ],
}
const DICE = { threshold: 75, result: 88.17 } // Roll Over 75 wins on 25 of 101 outcomes → 3.95x

type SlideId = 'football' | 'racing' | 'dice'

interface Chip { label: string; value: string; hot?: boolean }

interface Slide {
  id: SlideId
  href: string
  label: string
  icon: typeof Trophy
  accent: string
  title: string
  subtitle: string
  chips: Chip[]
  winOdds: number
}

function buildSlides(round: VFRound, race: Race): Slide[] {
  const o = round.odds['1x2']
  // Highlight the longest price — the upset is the exciting story
  const vfPicks: [string, number][] = [['1', o['1']], ['X', o.X], ['2', o['2']]]
  const vfHot = vfPicks.reduce((a, b) => (b[1] > a[1] ? b : a))

  const runners = race.horses.filter((h) => h.winOdds).slice(0, 3)
  const longshot = runners.reduce((a, b) => ((b.winOdds ?? 0) > (a.winOdds ?? 0) ? b : a), runners[0]!)
  // Same formula as packages/game-engine payoutMultiplier: 98% RTP over 101 possible rolls (0–100)
  const diceMultiplier = Math.floor((0.98 / ((100 - DICE.threshold) / 101)) * 100) / 100

  return [
    {
      id: 'football',
      href: '/virtual-football',
      label: 'Virtual Football',
      icon: Trophy,
      accent: '#0066FF',
      title: `${round.homeTeam.name} vs ${round.awayTeam.name}`,
      subtitle: `League ${round.league} · kicks off every 5 min`,
      chips: vfPicks.map(([label, v]) => ({ label, value: v.toFixed(2), hot: label === vfHot[0] })),
      winOdds: vfHot[1],
    },
    {
      id: 'racing',
      href: '/horse-racing',
      label: 'Horse Racing',
      icon: Zap,
      accent: '#F59E0B',
      title: `Longshot · ${longshot.name}`,
      subtitle: `Race ${race.raceNumber} · 8 runners`,
      chips: runners.map((h) => ({ label: `#${h.id}`, value: h.winOdds!.toFixed(2), hot: h.id === longshot.id })),
      winOdds: longshot.winOdds!,
    },
    {
      id: 'dice',
      href: '/dice',
      label: 'Dice',
      icon: Dices,
      accent: '#00D4FF',
      title: `Roll Over ${DICE.threshold}`,
      subtitle: 'Instant result · provably fair',
      chips: [
        { label: 'Roll', value: DICE.result.toFixed(2) },
        { label: 'Pays', value: `${diceMultiplier}x`, hot: true },
      ],
      winOdds: diceMultiplier,
    },
  ]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, { delay = 0.55, duration = 1.1, skip = false } = {}) {
  const [value, setValue] = useState(skip ? target : 0)
  useEffect(() => {
    if (skip) { setValue(target); return }
    const controls = animate(0, target, { delay, duration, ease: [0.16, 1, 0.3, 1], onUpdate: setValue })
    return () => controls.stop()
  }, [target, delay, duration, skip])
  return value
}

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

// ─── Art: football ────────────────────────────────────────────────────────────

function FootballArt({ still }: { still: boolean }) {
  const uid = useId().replace(/:/g, '')
  // Shared timeline: pass → bounce → shot → net
  const t = { duration: 2.4, times: [0, 0.3, 0.55, 0.8, 1], repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' as const }
  const run = !still

  return (
    <svg viewBox="0 0 160 72" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id={`pitch-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0066FF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#00D4FF" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="158" height="70" rx="9" fill={`url(#pitch-${uid})`} stroke="#1A2B4A" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={1 + i * 19.75} y="1" width="9.9" height="70" fill="#E6F1FF" opacity="0.025" />
      ))}
      <g stroke="#E6F1FF" strokeOpacity="0.2" strokeWidth="0.8" fill="none">
        <line x1="80" y1="1" x2="80" y2="71" />
        <circle cx="80" cy="36" r="11" />
        <rect x="1" y="20" width="18" height="32" />
        <rect x="141" y="20" width="18" height="32" />
      </g>
      <circle cx="80" cy="36" r="1.4" fill="#E6F1FF" fillOpacity="0.35" />

      {/* Goal mouth flashes as the ball goes in */}
      <motion.rect
        x="152" y="27" width="7" height="18" rx="1.5" fill="#00C48C"
        initial={{ opacity: 0 }}
        animate={run ? { opacity: [0, 0, 0, 0.9, 0] } : { opacity: 0 }}
        transition={t}
      />
      <motion.text
        x="128" y="15" textAnchor="middle" fontSize="10" fontWeight="900" fill="#00C48C"
        style={{ letterSpacing: '0.08em' }}
        initial={{ opacity: 0 }}
        animate={run ? { opacity: [0, 0, 0, 1, 0], y: [4, 4, 4, 0, -3] } : { opacity: 0 }}
        transition={t}
      >
        GOAL!
      </motion.text>

      {/* Shadow tracks the ball on the ground; shrinks while it's in the air */}
      {/* rx (not scaleX) — SVG scale transforms originate at the viewBox corner and drag the shadow off the ball */}
      <motion.g
        initial={{ x: 34 }}
        animate={run ? { x: [34, 92, 116, 152, 152], opacity: [1, 1, 1, 1, 0] } : { x: 92 }}
        transition={t}
      >
        <motion.ellipse
          cx="0" cy="60" ry="1.6" fill="#000" fillOpacity="0.45"
          initial={{ rx: 5 }}
          animate={run ? { rx: [5, 2.5, 5, 4, 4] } : { rx: 3 }}
          transition={t}
        />
      </motion.g>
      <motion.g
        initial={{ x: 34, y: 52 }}
        animate={run ? { x: [34, 92, 116, 152, 152], y: [52, 16, 50, 36, 36], rotate: [0, 260, 420, 720, 720], opacity: [1, 1, 1, 1, 0] } : { x: 92, y: 30 }}
        transition={t}
      >
        <circle r="5.5" fill="#F8FBFF" />
        <polygon points="0,-2.4 2.3,-0.7 1.4,2 -1.4,2 -2.3,-0.7" fill="#0F1B3D" />
        <circle r="5.5" fill="none" stroke="#0F1B3D" strokeOpacity="0.35" strokeWidth="0.6" />
      </motion.g>
    </svg>
  )
}

// ─── Art: racing ──────────────────────────────────────────────────────────────

const SILKS = ['#F59E0B', '#00D4FF', '#EC4899']

function RacingArt({ numbers, winnerIndex, still }: { numbers: number[]; winnerIndex: number; still: boolean }) {
  const uid = useId().replace(/:/g, '')
  // Each runner leads at a different point; the highlighted one gets up at the line
  const paths = [[10, 46, 84, 118], [10, 56, 98, 116], [10, 40, 92, 114]]
  const order = [...paths]
  // Give the winning path (index 0) to the highlighted runner
  ;[order[0], order[winnerIndex]] = [order[winnerIndex]!, order[0]!]
  const t = { duration: 2.6, times: [0, 0.35, 0.7, 1], repeat: Infinity, repeatDelay: 0.9, ease: 'easeInOut' as const }
  const lanes = [16, 36, 56]

  return (
    <svg viewBox="0 0 160 72" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id={`turf-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F59E0B" stopOpacity="0.04" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0.2" />
        </linearGradient>
        <pattern id={`check-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#E6F1FF" />
          <rect x="2" y="2" width="2" height="2" fill="#E6F1FF" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="158" height="70" rx="9" fill={`url(#turf-${uid})`} stroke="#1A2B4A" />
      {/* Rails scroll backwards to sell the speed */}
      {[26, 46].map((y) => (
        <motion.line
          key={y} x1="4" y1={y} x2="156" y2={y} stroke="#E6F1FF" strokeOpacity="0.14" strokeDasharray="6 5"
          animate={still ? undefined : { strokeDashoffset: [0, 22] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      <rect x="136" y="4" width="8" height="64" fill={`url(#check-${uid})`} opacity="0.55" />

      {numbers.map((n, i) => {
        const xs = order[i]!
        const isWinner = i === winnerIndex
        return (
          <motion.g
            key={n}
            initial={{ x: still ? xs[3] : 10 }}
            animate={still ? undefined : { x: xs }}
            transition={t}
          >
            <motion.g
              initial={{ y: lanes[i] }}
              animate={still ? undefined : { y: [lanes[i]!, lanes[i]! - 1.8, lanes[i]!] }}
              transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }}
              style={still ? { y: lanes[i] } : undefined}
            >
              {/* Speed streaks */}
              <rect x="-22" y="-2.4" width="12" height="1.2" rx="0.6" fill={SILKS[i]} opacity="0.45" />
              <rect x="-17" y="1.4" width="8" height="1.2" rx="0.6" fill={SILKS[i]} opacity="0.3" />
              {isWinner && (
                <motion.circle
                  r="8" fill="none" stroke={SILKS[i]} strokeWidth="1.2"
                  animate={still ? { opacity: 0.6 } : { opacity: [0, 0, 0.9, 0], scale: [1, 1, 1.5, 1.9] }}
                  transition={still ? undefined : { ...t, times: [0, 0.85, 0.92, 1] }}
                />
              )}
              <circle r="7" fill={SILKS[i]} stroke="#070B1A" strokeWidth="1.2" />
              <text y="2.6" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#070B1A">{n}</text>
            </motion.g>
          </motion.g>
        )
      })}
    </svg>
  )
}

// ─── Art: dice ────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[27, 22], [73, 22], [27, 50], [73, 50], [27, 78], [73, 78]],
}

function Die({ face, delay, still }: { face: 5 | 6; delay: number; still: boolean }) {
  return (
    <motion.div
      className="w-8 h-8 shrink-0"
      initial={still ? false : { rotate: -200, y: -18, opacity: 0 }}
      animate={still ? undefined : { rotate: [-200, 20, 0], y: [-18, 4, 0], opacity: 1 }}
      transition={{ delay, duration: 0.9, ease: [0.2, 0.9, 0.3, 1.2] }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_10px_rgba(0,212,255,0.35)]" aria-hidden>
        <rect x="4" y="4" width="92" height="92" rx="22" fill="#E6F1FF" />
        <rect x="4" y="4" width="92" height="92" rx="22" fill="none" stroke="#00D4FF" strokeWidth="4" strokeOpacity="0.6" />
        {PIPS[face]!.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="8.5" fill="#070B1A" />)}
      </svg>
    </motion.div>
  )
}

function DiceArt({ still }: { still: boolean }) {
  const roll = useCountUp(DICE.result, { delay: 0.35, duration: 1.2, skip: still })
  const pct = (roll / 100) * 100

  return (
    <div className="h-full rounded-[9px] border border-[#1A2B4A] bg-linear-to-br from-[#00D4FF]/18 to-[#0066FF]/4 px-2.5 py-2 flex flex-col justify-between">
      <div className="flex items-center gap-1.5">
        <Die face={6} delay={0.1} still={still} />
        <Die face={5} delay={0.22} still={still} />
        <div className="ml-auto text-right leading-none">
          <span className="block text-[8px] font-bold text-[#4D6B9A] uppercase tracking-widest">Result</span>
          <span className="text-lg font-black tabular-nums text-[#00C48C] drop-shadow-[0_0_10px_rgba(0,196,140,0.55)]">
            {roll.toFixed(2)}
          </span>
        </div>
      </div>
      {/* Win zone is everything above the threshold */}
      <div className="relative h-1.5 rounded-full bg-[#EF4444]/35">
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-linear-to-r from-[#00C48C]/70 to-[#00C48C]"
          style={{ left: `${DICE.threshold}%` }}
        />
        <div className="absolute -top-1 -bottom-1 w-px bg-[#E6F1FF]/70" style={{ left: `${DICE.threshold}%` }} />
        <div
          className="absolute top-1/2 w-2.5 h-2.5 -mt-[5px] -ml-[5px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Slide ────────────────────────────────────────────────────────────────────

function SlideBody({ slide, still, race }: { slide: Slide; still: boolean; race: Race }) {
  const returns = useCountUp(EXAMPLE_STAKE * slide.winOdds, { skip: still })
  const Icon = slide.icon
  const stagger = (i: number) => (still ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.12 + i * 0.07, duration: 0.35 } })

  const runnerNumbers = race.horses.filter((h) => h.winOdds).slice(0, 3).map((h) => h.id)
  const winnerIndex = Math.max(0, slide.chips.findIndex((c) => c.hot))

  return (
    <div className="relative h-full flex flex-col px-3 pt-5 pb-3">
      {/* Accent glow follows the slide */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: slide.accent, opacity: 0.28 }}
      />

      <motion.div {...stagger(0)} className="relative flex items-center gap-1.5 mb-2">
        <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `${slide.accent}26` }}>
          <Icon size={11} style={{ color: slide.accent }} />
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#E6F1FF] truncate">{slide.label}</span>
        <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-[#00C48C]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C48C] animate-pulse" />LIVE
        </span>
      </motion.div>

      <div className="relative h-[68px] sm:h-[92px] lg:h-[112px] shrink-0">
        {slide.id === 'football' && <FootballArt still={still} />}
        {slide.id === 'racing' && <RacingArt numbers={runnerNumbers} winnerIndex={winnerIndex} still={still} />}
        {slide.id === 'dice' && <DiceArt still={still} />}
      </div>

      <motion.div {...stagger(1)} className="relative mt-2 min-w-0">
        <p className="text-[11px] font-bold text-[#E6F1FF] truncate leading-tight">{slide.title}</p>
        <p className="text-[9px] text-[#4D6B9A] truncate">{slide.subtitle}</p>
      </motion.div>

      <div className="relative flex gap-1 mt-1.5">
        {slide.chips.map((chip, i) => (
          <motion.div
            key={chip.label}
            initial={still ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 420, damping: 18 }}
            className={cn(
              'flex-1 min-w-0 flex items-center justify-between gap-1 px-1.5 py-1 rounded-md border text-[9px] leading-none',
              chip.hot ? 'text-white' : 'border-[#1A2B4A] bg-[#081226] text-[#4D6B9A]',
            )}
            style={chip.hot ? { borderColor: slide.accent, backgroundColor: `${slide.accent}30`, boxShadow: `0 0 12px ${slide.accent}55` } : undefined}
          >
            <span className="font-semibold">{chip.label}</span>
            <span className={cn('font-black tabular-nums', chip.hot ? 'text-white' : 'text-[#E6F1FF]')}>{chip.value}</span>
          </motion.div>
        ))}
      </div>

      <motion.div {...stagger(3)} className="relative mt-auto pt-2 flex items-baseline gap-1.5">
        <span className="text-[9px] text-[#4D6B9A] whitespace-nowrap">{naira(EXAMPLE_STAKE)} returns</span>
        <span className="ml-auto text-base font-black tabular-nums text-[#00C48C] drop-shadow-[0_0_12px_rgba(0,196,140,0.6)]">
          {naira(returns)}
        </span>
      </motion.div>
    </div>
  )
}

// ─── Reel ─────────────────────────────────────────────────────────────────────

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '70%' : '-70%', opacity: 0, scale: 0.92, filter: 'blur(6px)' }),
  center: { x: '0%', opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: dir > 0 ? '-70%' : '70%', opacity: 0, scale: 0.92, filter: 'blur(6px)' }),
}
const fade = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

export function HighlightReel({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion() ?? false
  const [round, setRound] = useState<VFRound>(FALLBACK_ROUND)
  const [race, setRace] = useState<Race>(FALLBACK_RACE)
  const [[index, direction], setPage] = useState<[number, number]>([0, 1])
  const [paused, setPaused] = useState(false)
  const dragged = useRef(false)

  useEffect(() => {
    api.get<VFRound[]>('/virtual/football/current')
      .then((r) => { if (r.data?.[0]?.odds) setRound(r.data[0]) })
      .catch(() => {})
    api.get<Race | null>('/virtual/horse-racing/current')
      .then((r) => { if (r.data && r.data.horses.filter((h) => h.winOdds).length >= 3) setRace(r.data) })
      .catch(() => {})
  }, [])

  const slides = useMemo(() => buildSlides(round, race), [round, race])
  const slide = slides[index]!

  const go = useCallback((dir: number) => {
    setPage(([i]) => [(i + dir + slides.length) % slides.length, dir])
  }, [slides.length])

  const jump = (i: number) => setPage(([cur]) => [i, i >= cur ? 1 : -1])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2
    if (Math.abs(swipe) > 40) {
      dragged.current = true
      go(swipe < 0 ? 1 : -1)
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured games"
      className={cn(
        'relative h-[228px] sm:h-[258px] lg:h-[280px] rounded-2xl border border-[#1A2B4A] bg-[#0F1B3D] overflow-hidden isolate',
        'shadow-[0_10px_40px_-12px_rgba(0,102,255,0.45)]',
        className,
      )}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPaused(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPaused(false) }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Accent border glow cross-fades with the slide */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none z-20"
        animate={{ boxShadow: `inset 0 0 0 1px ${slide.accent}55` }}
        transition={{ duration: 0.6 }}
      />
      <div className="reel-shine absolute inset-0 pointer-events-none z-20" />

      {/* Story-style progress — the active bar's animation end advances the reel */}
      <div className="absolute top-2 inset-x-3 z-30 flex gap-1">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(i)}
            aria-label={`Show ${s.label}`}
            aria-current={i === index}
            className="flex-1 h-3 -my-1 flex items-center"
          >
            <span className="relative block w-full h-[3px] rounded-full bg-[#E6F1FF]/15 overflow-hidden">
              {i < index && <span className="absolute inset-0 bg-[#E6F1FF]/70" />}
              {i === index && (
                <span
                  key={`${index}-${slides.length}`}
                  className="absolute inset-0 origin-left bg-[#E6F1FF]"
                  style={{
                    animation: `reel-progress ${SLIDE_MS}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                  onAnimationEnd={() => go(1)}
                />
              )}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={slide.id}
          custom={direction}
          variants={reduceMotion ? fade : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 260, damping: 30 },
            scale: { type: 'spring', stiffness: 260, damping: 30 },
            opacity: { duration: 0.25 },
            filter: { duration: 0.3 },
          }}
          drag={reduceMotion ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.35}
          onDragStart={() => { dragged.current = false }}
          onDragEnd={onDragEnd}
          className="absolute inset-0 z-10 touch-pan-y"
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}
        >
          <Link
            href={slide.href}
            draggable={false}
            className="block h-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#00D4FF] rounded-2xl"
            onClick={(e) => { if (dragged.current) { e.preventDefault(); dragged.current = false } }}
          >
            <SlideBody slide={slide} still={reduceMotion} race={race} />
          </Link>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
