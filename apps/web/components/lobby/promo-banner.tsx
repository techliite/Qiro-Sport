'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { ChevronRight, Trophy, Dices, Zap } from 'lucide-react'
import { cn } from '@qiro/ui'
import { Jockey, Striker } from './athletes'

const SLIDE_MS = 6000

type Scene = 'stadium' | 'striker' | 'race-photo' | 'jockey' | 'dice'

interface PromoSlide {
  scene: Scene
  href: string
  icon: typeof Trophy
  kicker: string
  line: string
  cta: string
  accent: string
}

const SLIDES: PromoSlide[] = [
  { scene: 'stadium',    href: '/virtual-football', icon: Trophy, kicker: 'Virtual Football',  line: 'A new kick-off every 5 minutes',        cta: 'Bet Now',       accent: '#0066FF' },
  { scene: 'striker',    href: '/virtual-football', icon: Trophy, kicker: 'Strike First',      line: '1X2, BTTS, Correct Score & more',       cta: 'Play Football', accent: '#00D4FF' },
  { scene: 'race-photo', href: '/horse-racing',     icon: Zap,    kicker: 'Horse Racing',      line: '8 runners. A race every 3 minutes',     cta: 'Pick a Winner', accent: '#F59E0B' },
  { scene: 'jockey',     href: '/horse-racing',     icon: Zap,    kicker: 'Back the Longshot', line: 'Win & Place markets, paid instantly',   cta: 'Race Now',      accent: '#F59E0B' },
  { scene: 'dice',       href: '/dice',             icon: Dices,  kicker: 'Dice',              line: 'Roll over or under — up to 49x',        cta: 'Roll Now',      accent: '#00D4FF' },
]

// ─── Scenes ───────────────────────────────────────────────────────────────────

function PhotoBackdrop({ src, priority, still, position = 'center' }: { src: string; priority?: boolean; still: boolean; position?: string }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={still ? false : { scale: 1.14, x: '2%' }}
      animate={{ scale: 1.02, x: '0%' }}
      transition={{ duration: SLIDE_MS / 1000 + 1, ease: 'easeOut' }}
    >
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 1200px, 100vw"
        className="object-cover"
        style={{ objectPosition: position }}
      />
    </motion.div>
  )
}

// Keeps the headline readable on any photo and pulls every scene into the brand palette
function Scrim({ tint }: { tint: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-linear-to-r from-[#070B1A] via-[#070B1A]/80 via-45% to-[#070B1A]/10" />
      <div className="absolute inset-0 bg-linear-to-t from-[#070B1A]/90 via-transparent to-[#070B1A]/30" />
      {/* Flat tint (not mix-blend) — blend modes force a full-layer repaint every frame */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundColor: tint }} />
    </>
  )
}

function StadiumScene({ still }: { still: boolean }) {
  return (
    <>
      <PhotoBackdrop src="/banners/stadium-dusk.jpg" priority still={still} position="65% 60%" />
      <Scrim tint="#0A2A6B" />
      {/* Floodlight flares breathing over the stands */}
      {[{ l: '58%', t: '18%', d: 0 }, { l: '88%', t: '10%', d: 0.8 }].map((f, i) => (
        <motion.div
          key={i}
          className="absolute w-40 h-40 -ml-20 -mt-20 rounded-full pointer-events-none"
          style={{ left: f.l, top: f.t, background: 'radial-gradient(circle, rgba(200,230,255,0.55), rgba(0,102,255,0.15) 40%, transparent 70%)' }}
          animate={still ? undefined : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 2.6, delay: f.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  )
}

function StrikerScene({ still }: { still: boolean }) {
  return (
    <>
      <PhotoBackdrop src="/banners/floodlit-pitch.jpg" still={still} position="50% 70%" />
      <Scrim tint="#003B73" />
      <div className="absolute right-[-6%] sm:right-[6%] bottom-[2%] w-[56%] sm:w-[40%] h-[84%] flex items-end">
        <div className="absolute inset-x-[10%] bottom-[6%] h-1/2 rounded-full bg-[#00D4FF]/25 blur-3xl" />
        <Striker still={still} className="relative w-full h-full" />
      </div>
    </>
  )
}

function RacePhotoScene({ still }: { still: boolean }) {
  return (
    <>
      <PhotoBackdrop src="/banners/horse-race.webp" still={still} position="60% 55%" />
      <Scrim tint="#5A3300" />
      {/* Speed streaks rushing past the field */}
      {!still && [22, 48, 70, 84].map((top, i) => (
        <motion.div
          key={top}
          className="absolute h-px w-1/3 bg-linear-to-r from-transparent via-white/70 to-transparent"
          style={{ top: `${top}%` }}
          initial={{ left: '110%' }}
          animate={{ left: '-40%' }}
          transition={{ duration: 0.9 + i * 0.15, delay: i * 0.35, repeat: Infinity, repeatDelay: 0.6, ease: 'easeIn' }}
        />
      ))}
    </>
  )
}

function JockeyScene({ still }: { still: boolean }) {
  return (
    <>
      <div className="absolute inset-0 bg-linear-to-b from-[#2A1406] via-[#7A3A0C] to-[#F59E0B]" />
      {/* Setting sun */}
      <div className="absolute right-[12%] top-[18%] w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-[radial-gradient(circle,#FFE3A3,#F59E0B_55%,transparent_70%)] opacity-80" />
      {/* Far hills drift slowly, rails race past — parallax sells the gallop */}
      <motion.div
        className="absolute bottom-[22%] left-0 h-16 w-[200%] opacity-60"
        style={{ background: 'radial-gradient(60% 100% at 25% 100%, #3B1A05 60%, transparent 61%), radial-gradient(50% 90% at 70% 100%, #4A2208 60%, transparent 61%)', backgroundSize: '50% 100%' }}
        animate={still ? undefined : { x: ['0%', '-50%'] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[24%] bg-[#1F0E04]" />
      <motion.div
        className="absolute bottom-[24%] left-0 h-5 w-[200%]"
        style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,240,215,0.85) 0 4px, transparent 4px 46px)', backgroundSize: '46px 100%', borderTop: '3px solid rgba(255,240,215,0.85)' }}
        animate={still ? undefined : { x: ['0px', '-460px'] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
      <Scrim tint="#3D1F00" />
      <div className="absolute right-[-4%] sm:right-[4%] bottom-[6%] w-[64%] sm:w-[46%] h-[72%]">
        {!still && [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute bottom-[12%] left-[28%] w-6 h-6 rounded-full bg-[#FFD9A0]/40 blur-sm"
            animate={{ x: [0, -90], y: [0, -14], opacity: [0.7, 0], scale: [0.6, 1.8] }}
            transition={{ duration: 0.8, delay: i * 0.27, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
        <Jockey still={still} className="relative w-full h-full" />
      </div>
    </>
  )
}

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}
const CUBE_FACES: [number, string][] = [
  [1, 'rotateY(0deg)'], [6, 'rotateY(180deg)'], [3, 'rotateY(90deg)'],
  [4, 'rotateY(-90deg)'], [2, 'rotateX(90deg)'], [5, 'rotateX(-90deg)'],
]

function Cube({ size, delay, still, spin }: { size: number; delay: number; still: boolean; spin: [number, number] }) {
  const half = size / 2
  return (
    <div style={{ width: size, height: size, perspective: 600 }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: -24, rotateY: 32 }}
        animate={still ? undefined : { rotateX: [-24, -24 + spin[0]], rotateY: [32, 32 + spin[1]], y: [0, -10, 0] }}
        transition={{ duration: 5, delay, repeat: Infinity, ease: 'linear', y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}
      >
        {CUBE_FACES.map(([pips, rot]) => (
          <div
            key={pips}
            className="absolute inset-0 rounded-[22%] bg-linear-to-br from-white to-[#CFE6FF] border border-[#00D4FF]/60 shadow-[inset_0_0_18px_rgba(0,102,255,0.25)]"
            style={{ transform: `${rot} translateZ(${half}px)`, backfaceVisibility: 'hidden' }}
          >
            {PIP_LAYOUT[pips]!.map(([x, y], i) => (
              <span key={i} className="absolute w-[17%] h-[17%] -ml-[8.5%] -mt-[8.5%] rounded-full bg-[#070B1A]" style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

function DiceScene({ still }: { still: boolean }) {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_40%,#0B4A6B_0%,#081A3A_45%,#070B1A_80%)]" />
      {/* Neon perspective floor — the tilt lives on a plain div and the grid scrolls by
          translateY, because framer owns the inner element's transform */}
      <div className="absolute inset-x-[-30%] bottom-0 h-[55%] overflow-hidden" style={{ transform: 'perspective(260px) rotateX(55deg)', transformOrigin: '50% 100%' }}>
        <motion.div
          className="absolute inset-x-0 -top-10 h-[calc(100%+40px)]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,212,255,0.45) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(0,212,255,0.45) 1.5px, transparent 1.5px)',
            backgroundSize: '40px 40px',
          }}
          animate={still ? undefined : { y: [0, 40] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-b from-[#070B1A] via-transparent to-transparent" />
      <Scrim tint="#002A40" />
      <div className="absolute right-[4%] sm:right-[12%] top-1/2 -translate-y-1/2 flex items-end gap-4 sm:gap-8">
        <div className="absolute -inset-6 rounded-full bg-[#00D4FF]/25 blur-3xl" />
        <Cube size={64} delay={0} still={still} spin={[360, 360]} />
        <div className="hidden min-[360px]:block -mb-6">
          <Cube size={50} delay={0.4} still={still} spin={[-360, 360]} />
        </div>
      </div>
    </>
  )
}

function SceneView({ scene, still }: { scene: Scene; still: boolean }) {
  switch (scene) {
    case 'stadium': return <StadiumScene still={still} />
    case 'striker': return <StrikerScene still={still} />
    case 'race-photo': return <RacePhotoScene still={still} />
    case 'jockey': return <JockeyScene still={still} />
    case 'dice': return <DiceScene still={still} />
  }
}

// ─── Banner ───────────────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%' }),
  center: { x: '0%' },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%' }),
}
const fadeVariants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }

export function PromoBanner({ className }: { className?: string }) {
  const still = useReducedMotion() ?? false
  const [[index, direction], setPage] = useState<[number, number]>([0, 1])
  const [paused, setPaused] = useState(false)
  const dragged = useRef(false)
  const slide = SLIDES[index]!
  const Icon = slide.icon

  const go = useCallback((dir: number) => {
    setPage(([i]) => [(i + dir + SLIDES.length) % SLIDES.length, dir])
  }, [])
  const jump = (i: number) => setPage(([cur]) => [i, i >= cur ? 1 : -1])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2
    if (Math.abs(swipe) > 50) {
      dragged.current = true
      go(swipe < 0 ? 1 : -1)
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Qiro Sport promotions"
      className={cn(
        'relative isolate overflow-hidden rounded-3xl border border-[#1A2B4A] bg-[#070B1A]',
        'h-[268px] sm:h-[320px] lg:h-[380px] shadow-[0_20px_60px_-20px_rgba(0,102,255,0.55)]',
        className,
      )}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPaused(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPaused(false) }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Scenes slide in/out underneath the fixed headline */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={slide.scene}
          custom={direction}
          variants={still ? fadeVariants : slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ x: { type: 'spring', stiffness: 170, damping: 26 }, opacity: { duration: 0.4 } }}
          drag={still ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragStart={() => { dragged.current = false }}
          onDragEnd={onDragEnd}
          className="absolute inset-0 touch-pan-y"
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${SLIDES.length}: ${slide.kicker}`}
        >
          <SceneView scene={slide.scene} still={still} />
        </motion.div>
      </AnimatePresence>

      <div className="reel-shine absolute inset-0 pointer-events-none" />

      {/* Landing-page headline — stays put while the scenes change */}
      <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-10 lg:px-14 max-w-[64%] sm:max-w-[56%] pointer-events-none">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className="w-6 h-6 rounded-lg bg-[#0066FF] flex items-center justify-center shadow-[0_0_12px_rgba(0,102,255,0.6)]">
            <Zap size={13} fill="white" className="text-white" />
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-[#7FB2FF] uppercase tracking-[0.2em]">Qiro Sport</span>
        </div>

        <h1 className="text-[28px] leading-[1.02] sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          Play & Win<br />
          <span className="bg-linear-to-r from-[#3D8BFF] via-[#00D4FF] to-[#3D8BFF] bg-clip-text text-transparent">Instantly</span>
        </h1>

        {/* Per-slide line + CTA swap with the scene */}
        <div className="mt-3 sm:mt-5 min-h-[76px] sm:min-h-[92px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.scene}
              initial={still ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={still ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} style={{ color: slide.accent }} />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest" style={{ color: slide.accent }}>
                  {slide.kicker}
                </span>
              </div>
              <p className="text-xs sm:text-base text-[#C9DBF5] leading-snug mb-2.5 sm:mb-4">{slide.line}</p>
              <Link
                href={slide.href}
                onClick={(e) => { if (dragged.current) { e.preventDefault(); dragged.current = false } }}
                className="pointer-events-auto inline-flex items-center gap-1 h-9 sm:h-11 pl-4 pr-3 sm:pl-6 sm:pr-4 rounded-full text-xs sm:text-sm font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] shadow-[0_8px_24px_-6px_rgba(0,102,255,0.8)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]"
              >
                {slide.cta}
                <ChevronRight size={16} />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Pager — active pill fills over the slide duration and advances the carousel */}
      <div className="absolute z-20 bottom-3 sm:bottom-5 right-4 sm:right-8 flex items-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.scene}
            type="button"
            onClick={() => jump(i)}
            aria-label={`Show ${s.kicker}`}
            aria-current={i === index}
            className="h-4 flex items-center"
          >
            <span
              className={cn(
                'relative block h-1.5 rounded-full overflow-hidden transition-all duration-300',
                i === index ? 'w-7 bg-white/25' : 'w-1.5 bg-white/40 hover:bg-white/70',
              )}
            >
              {i === index && (
                <span
                  key={index}
                  className="absolute inset-0 origin-left bg-white"
                  style={{ animation: `reel-progress ${SLIDE_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                  onAnimationEnd={() => go(1)}
                />
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
