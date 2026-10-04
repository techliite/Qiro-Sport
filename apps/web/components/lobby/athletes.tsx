'use client'

// Pictogram-style athletes driven by a tiny forward-kinematics rig.
// Each frame we interpolate joint angles from pose keyframes and write line
// endpoints straight to the DOM (no React re-render per frame).

import { useRef } from 'react'
import { useAnimationFrame } from 'framer-motion'

type Pt = [number, number]

const rad = (deg: number) => (deg * Math.PI) / 180
// Angle convention: 0° points straight down, +90° points forward (right), 180° up
const seg = (from: Pt, angle: number, len: number): Pt => [
  from[0] + len * Math.sin(rad(angle)),
  from[1] + len * Math.cos(rad(angle)),
]
const smooth = (x: number) => x * x * (3 - 2 * x)

function setLine(el: SVGLineElement | null, a: Pt, b: Pt) {
  if (!el) return
  el.setAttribute('x1', a[0].toFixed(2))
  el.setAttribute('y1', a[1].toFixed(2))
  el.setAttribute('x2', b[0].toFixed(2))
  el.setAttribute('y2', b[1].toFixed(2))
}
function setCircle(el: SVGCircleElement | null, c: Pt, opacity?: number) {
  if (!el) return
  el.setAttribute('cx', c[0].toFixed(2))
  el.setAttribute('cy', c[1].toFixed(2))
  if (opacity !== undefined) el.setAttribute('opacity', opacity.toFixed(3))
}

/** Interpolate a numeric pose between keyframes [t, pose] (t in 0..1, first and last should match). */
function samplePose<P extends Record<string, number>>(frames: [number, P][], t: number): P {
  let i = 0
  while (i < frames.length - 2 && t > frames[i + 1]![0]) i++
  const [t0, a] = frames[i]!
  const [t1, b] = frames[i + 1]!
  const k = smooth(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))))
  const out = {} as Record<string, number>
  for (const key in a) out[key] = a[key]! + (b[key]! - a[key]!) * k
  return out as P
}

function useRig(update: (t: number) => void, periodMs: number, still: boolean, stillT: number) {
  const ran = useRef(false)
  useAnimationFrame((time) => {
    if (still) {
      if (!ran.current) { update(stillT); ran.current = true }
      return
    }
    update((time % periodMs) / periodMs)
  })
}

// ─── Striker ──────────────────────────────────────────────────────────────────

interface KickPose extends Record<string, number> {
  lean: number
  kThigh: number; kShin: number   // kicking (front) leg
  sThigh: number; sShin: number   // standing leg
  fArm: number; fFore: number     // front arm (counter-balance)
  bArm: number; bFore: number
}

// Athletic ready stance: knees soft, arms out for balance
const REST: KickPose = { lean: 12, kThigh: 14, kShin: -18, sThigh: -14, sShin: -24, fArm: 48, fFore: 84, bArm: -42, bFore: -12 }
const KICK: [number, KickPose][] = [
  [0, REST],
  [0.3, { lean: -4, kThigh: -42, kShin: -128, sThigh: 8, sShin: -2, fArm: 112, fFore: 142, bArm: -52, bFore: -30 }],
  [0.42, { lean: 12, kThigh: 36, kShin: 26, sThigh: -10, sShin: -15, fArm: 74, fFore: 96, bArm: -72, bFore: -58 }],
  [0.56, { lean: -14, kThigh: 84, kShin: 92, sThigh: -6, sShin: -10, fArm: 44, fFore: 74, bArm: -104, bFore: -84 }],
  [1, REST],
]

const S = { torso: 62, neck: 20, thigh: 48, shin: 48, upper: 34, fore: 32 }
const BALL_REST: Pt = [50, 82]
const STRIKE_T = 0.42

export function Striker({ still = false, className }: { still?: boolean; className?: string }) {
  const r = useRef<Record<string, SVGLineElement | SVGCircleElement | SVGPathElement | null>>({})
  const ref = (k: string) => (el: SVGLineElement | SVGCircleElement | SVGPathElement | null) => { r.current[k] = el }

  useRig((t) => {
    const p = samplePose(KICK, t)
    const hip: Pt = [0, 0]
    const neck = seg(hip, 180 + p.lean, S.torso)
    const head = seg(neck, 180 + p.lean, S.neck)
    const kKnee = seg(hip, p.kThigh, S.thigh)
    const kFoot = seg(kKnee, p.kShin, S.shin)
    const sKnee = seg(hip, p.sThigh, S.thigh)
    const sFoot = seg(sKnee, p.sShin, S.shin)
    const fElbow = seg(neck, p.fArm, S.upper)
    const fHand = seg(fElbow, p.fFore, S.fore)
    const bElbow = seg(neck, p.bArm, S.upper)
    const bHand = seg(bElbow, p.bFore, S.fore)

    setLine(r.current.torso as SVGLineElement, hip, neck)
    setCircle(r.current.head as SVGCircleElement, head)
    setLine(r.current.kThigh as SVGLineElement, hip, kKnee)
    setLine(r.current.kShin as SVGLineElement, kKnee, kFoot)
    setLine(r.current.sThigh as SVGLineElement, hip, sKnee)
    setLine(r.current.sShin as SVGLineElement, sKnee, sFoot)
    setLine(r.current.fArm as SVGLineElement, neck, fElbow)
    setLine(r.current.fFore as SVGLineElement, fElbow, fHand)
    setLine(r.current.bArm as SVGLineElement, neck, bElbow)
    setLine(r.current.bFore as SVGLineElement, bElbow, bHand)

    // Kit rides on the same bones: shorts on the upper thigh, socks on the lower shin
    const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    setLine(r.current.kShorts as SVGLineElement, hip, lerp(hip, kKnee, 0.5))
    setLine(r.current.sShorts as SVGLineElement, hip, lerp(hip, sKnee, 0.5))
    setLine(r.current.kSock as SVGLineElement, lerp(kKnee, kFoot, 0.5), kFoot)
    setLine(r.current.sSock as SVGLineElement, lerp(sKnee, sFoot, 0.5), sFoot)
    setCircle(r.current.kBoot as SVGCircleElement, kFoot)
    setCircle(r.current.sBoot as SVGCircleElement, sFoot)

    // Ball: sits at the boot, launches on contact, fades back in for the next kick
    let ball: Pt = BALL_REST
    let ballOpacity = 1
    if (t >= STRIKE_T) {
      const f = (t - STRIKE_T) / (1 - STRIKE_T)
      ball = [BALL_REST[0] + f * 520, BALL_REST[1] - f * 230 + f * f * 60]
      ballOpacity = Math.max(0, 1 - f * 2.2)
    } else if (t < 0.18) {
      ballOpacity = smooth(t / 0.18)
    }
    setCircle(r.current.ball as SVGCircleElement, ball, ballOpacity)
    setCircle(r.current.ballCore as SVGCircleElement, ball, ballOpacity)

    // Swoosh trail flashes through the strike
    const swoosh = r.current.swoosh as SVGPathElement | null
    if (swoosh) {
      const s = t > 0.42 && t < 0.66 ? Math.sin(((t - 0.42) / 0.24) * Math.PI) : 0
      swoosh.setAttribute('opacity', (s * 0.9).toFixed(3))
    }
  }, 1500, still, 0.42)

  const limb = { strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="-110 -130 260 250" className={className} aria-hidden>
      <defs>
        <linearGradient id="striker-front" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#9CCBFF" />
        </linearGradient>
        <linearGradient id="striker-swoosh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#00D4FF" stopOpacity="0" />
          <stop offset="1" stopColor="#00D4FF" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="8" cy="98" rx="62" ry="6" fill="#000" opacity="0.35" />

      <path
        ref={ref('swoosh')}
        d="M -40 70 Q 10 110 60 80"
        stroke="url(#striker-swoosh)" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0"
      />

      {/* No SVG blur filter here — it would re-rasterise every animation frame.
          The glow comes from the static blurred light the scene places behind the figure. */}
      <g>
        {/* Far-side limbs first, darker for depth */}
        <g stroke="#7FA6E0" {...limb}>
          <line ref={ref('bArm')} strokeWidth="12" />
          <line ref={ref('bFore')} strokeWidth="10" />
          <line ref={ref('sThigh')} strokeWidth="16" />
          <line ref={ref('sShin')} strokeWidth="13" />
        </g>
        <line ref={ref('sShorts')} stroke="#0A1F4D" strokeWidth="21" {...limb} />
        <line ref={ref('sSock')} stroke="#0096B8" strokeWidth="14" {...limb} />
        <circle ref={ref('sBoot')} r="8" fill="#070B1A" />

        {/* Jersey */}
        <line ref={ref('torso')} stroke="#0066FF" strokeWidth="26" {...limb} />
        <circle ref={ref('head')} r="13" fill="url(#striker-front)" />

        <g stroke="url(#striker-front)" {...limb}>
          <line ref={ref('kThigh')} strokeWidth="17" />
          <line ref={ref('kShin')} strokeWidth="14" />
        </g>
        <line ref={ref('kShorts')} stroke="#0A1F4D" strokeWidth="22" {...limb} />
        <line ref={ref('kSock')} stroke="#00D4FF" strokeWidth="15" {...limb} />
        <circle ref={ref('kBoot')} r="8.5" fill="#070B1A" stroke="#00D4FF" strokeWidth="1.5" />
        <g stroke="url(#striker-front)" {...limb}>
          <line ref={ref('fArm')} strokeWidth="12" />
          <line ref={ref('fFore')} strokeWidth="10" />
        </g>
      </g>

      <circle ref={ref('ball')} r="10" fill="#FFFFFF" />
      <circle ref={ref('ballCore')} r="4" fill="#0F1B3D" />
    </svg>
  )
}

// ─── Jockey on a galloping horse ──────────────────────────────────────────────

interface Leg { hip: Pt; phase: number; far: boolean; fore: boolean }

// Rotary gallop footfall order: hind-left, hind-right, fore-left, fore-right
const LEGS: Leg[] = [
  { hip: [-44, 8], phase: 0.0, far: true, fore: false },
  { hip: [36, 8], phase: 0.55, far: true, fore: true },
  { hip: [-36, 10], phase: 0.12, far: false, fore: false },
  { hip: [44, 10], phase: 0.67, far: false, fore: true },
]
const H = { thigh: 30, shin: 36 }

function legAngles(leg: Leg, t: number): [number, number] {
  const p = 2 * Math.PI * ((t + leg.phase) % 1)
  const swing = Math.sin(p)                         // +1 reaching forward, -1 pushing back
  const lift = Math.max(0, Math.cos(p - 0.4))       // leg folds while travelling forward
  if (leg.fore) {
    const thigh = 8 + 34 * swing
    return [thigh, thigh - 95 * lift]               // knee folds back, hoof tucks up
  }
  const thigh = -6 + 30 * swing
  return [thigh, thigh + 70 * lift - 18]            // hock flexes forward
}

export function Jockey({ still = false, className }: { still?: boolean; className?: string }) {
  const r = useRef<Record<string, SVGElement | null>>({})
  const ref = (k: string) => (el: SVGElement | null) => { r.current[k] = el }

  useRig((t) => {
    // Two body bounces per stride; slight pitch rocking
    const bob = -5 * Math.sin(4 * Math.PI * t)
    const pitch = 3.5 * Math.sin(2 * Math.PI * t + 0.8)
    const body = r.current.body
    if (body) body.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${pitch.toFixed(2)})`)

    LEGS.forEach((leg, i) => {
      const [thigh, shin] = legAngles(leg, t)
      const knee = seg(leg.hip, thigh, H.thigh)
      const hoof = seg(knee, shin, H.shin)
      setLine(r.current[`t${i}`] as SVGLineElement, leg.hip, knee)
      setLine(r.current[`s${i}`] as SVGLineElement, knee, hoof)
    })

    // Jockey absorbs the bounce — counter-moves against the horse
    const jockey = r.current.jockey
    if (jockey) jockey.setAttribute('transform', `translate(0 ${(-bob * 0.45).toFixed(2)})`)

    const tail = r.current.tail
    if (tail) {
      const w = 10 * Math.sin(2 * Math.PI * t * 2)
      tail.setAttribute('d', `M -62 -6 Q ${(-90).toFixed(1)} ${(-2 + w).toFixed(1)} ${(-104).toFixed(1)} ${(14 - w).toFixed(1)}`)
    }
    const mane = r.current.mane
    if (mane) {
      const w = 3 * Math.sin(2 * Math.PI * t * 2 + 1)
      mane.setAttribute('d', `M 70 -50 Q 58 ${(-40 + w).toFixed(1)} 46 ${(-24 - w).toFixed(1)}`)
    }
  }, 620, still, 0.3)

  const limb = { strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="-125 -95 250 175" className={className} aria-hidden>
      <defs>
        <linearGradient id="horse-coat" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2547" />
          <stop offset="1" stopColor="#070B1A" />
        </linearGradient>
      </defs>

      <ellipse cx="0" cy="62" rx="90" ry="6" fill="#000" opacity="0.3" />

      <g ref={ref('body')}>
        {/* Far legs behind the body */}
        <g stroke="#0D1430" {...limb}>
          {[0, 1].map((i) => (
            <g key={i}>
              <line ref={ref(`t${i}`)} strokeWidth="10" />
              <line ref={ref(`s${i}`)} strokeWidth="6" />
            </g>
          ))}
        </g>

        <path ref={ref('tail')} stroke="#0D1430" strokeWidth="9" {...limb} />
        <line x1="-46" y1="0" x2="40" y2="-4" stroke="url(#horse-coat)" strokeWidth="36" {...limb} />
        <path d="M -58 -12 Q -10 -22 44 -20" stroke="#FFC56B" strokeOpacity="0.7" strokeWidth="2.5" {...limb} />
        <line x1="36" y1="-8" x2="66" y2="-48" stroke="url(#horse-coat)" strokeWidth="20" {...limb} />
        <line x1="66" y1="-48" x2="92" y2="-34" stroke="url(#horse-coat)" strokeWidth="14" {...limb} />
        <line x1="66" y1="-60" x2="70" y2="-70" stroke="#1B2547" strokeWidth="6" {...limb} />
        <path ref={ref('mane')} stroke="#070B1A" strokeWidth="7" {...limb} />

        <g stroke="url(#horse-coat)" {...limb}>
          {[2, 3].map((i) => (
            <g key={i}>
              <line ref={ref(`t${i}`)} strokeWidth="11" />
              <line ref={ref(`s${i}`)} strokeWidth="6.5" />
            </g>
          ))}
        </g>

        {/* Jockey — crouched race position in Qiro silks */}
        <g ref={ref('jockey')} {...limb}>
          <line x1="-6" y1="-24" x2="10" y2="-12" stroke="#E6F1FF" strokeWidth="10" />
          <line x1="10" y1="-12" x2="2" y2="-2" stroke="#E6F1FF" strokeWidth="8" />
          <line x1="-6" y1="-26" x2="28" y2="-40" stroke="#0066FF" strokeWidth="17" />
          <line x1="28" y1="-40" x2="46" y2="-30" stroke="#0066FF" strokeWidth="8" />
          <line x1="46" y1="-30" x2="60" y2="-36" stroke="#E6F1FF" strokeWidth="6" />
          <circle cx="40" cy="-50" r="9" fill="#00D4FF" />
          <line x1="44" y1="-55" x2="52" y2="-52" stroke="#00D4FF" strokeWidth="4" />
        </g>
      </g>
    </svg>
  )
}
