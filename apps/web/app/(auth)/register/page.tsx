'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, User, Calendar, Lock, Eye, EyeOff, Zap, ChevronLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useWalletStore } from '@/store/wallet.store'

// ─── Schemas ────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  // Spaces/dashes allowed while typing; the API stores every number as +234XXXXXXXXXX
  phone: z.string().transform((v) => v.replace(/[\s\-()]/g, '')).pipe(z.string().regex(/^\+?234[0-9]{10}$|^0[7-9][0-1][0-9]{8}$/, 'Enter a valid Nigerian number, e.g. 0805 947 2483')),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  dob: z.string().refine((d) => {
    const date = new Date(d)
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000)
    return age >= 18
  }, 'You must be 18 or older to register'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type Step1Data = z.infer<typeof step1Schema>

interface RegisterResponse { phone: string }
interface VerifyResponse {
  accessToken: string
  user: { id: string; phone: string; username: string }
}

// ─── OTP Input ───────────────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, '').split('').slice(0, 6)

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/g, '').slice(0, 1)
    const next = [...digits]
    next[i] = d
    onChange(next.join(''))
    if (d && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(text.padEnd(6, ''))
    inputs.current[Math.min(text.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-14 text-center text-xl font-bold bg-[#081226] border border-[#1A2B4A] rounded-xl text-[#E6F1FF] focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.2)] transition-all caret-[#0066FF]"
        />
      ))}
    </div>
  )
}

// ─── Step Indicators ─────────────────────────────────────────────────────────

function Steps({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            n < current
              ? 'bg-[#0066FF] text-white shadow-[0_0_12px_rgba(0,102,255,0.5)]'
              : n === current
              ? 'bg-[#0066FF] text-white shadow-[0_0_16px_rgba(0,102,255,0.6)] ring-2 ring-[#0066FF]/30'
              : 'bg-[#162040] text-[#4D6B9A] border border-[#1A2B4A]'
          }`}>{n}</div>
          {n < 2 && <div className={`h-px w-8 transition-all ${current > n ? 'bg-[#0066FF]' : 'bg-[#1A2B4A]'}`} />}
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setBalance = useWalletStore((s) => s.setBalance)

  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  })

  // Step 1 — Register
  const onStep1 = async (data: Step1Data) => {
    setServerError('')
    setIsSubmitting(true)
    try {
      const res = await api.post<RegisterResponse>('/auth/register', {
        phone: data.phone,
        username: data.username,
        dob: data.dob,
        password: data.password,
      })
      setPhone(res.data.phone)
      setStep(2)
      startResendCooldown()
    } catch (err: unknown) {
      setServerError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 2 — Verify OTP
  const onVerifyOtp = async () => {
    if (otp.length < 6) { setServerError('Enter the 6-digit code'); return }
    setServerError('')
    setIsSubmitting(true)
    try {
      const res = await api.post<VerifyResponse>('/auth/verify-otp', { phone, otp })
      setAuth(res.data.user, res.data.accessToken)
      api.get<{ balanceKobo: number }>('/wallet/balance').then((r) => setBalance(r.data.balanceKobo)).catch(() => null)
      router.replace('/sports')
    } catch (err: unknown) {
      setServerError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Verification failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startResendCooldown = () => {
    setResendCooldown(60)
    const t = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
  }

  const resendOtp = async () => {
    if (resendCooldown > 0) return
    try {
      await api.post('/auth/otp/resend', { phone })
      startResendCooldown()
    } catch (err: unknown) {
      setServerError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to resend OTP')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#0066FF] flex items-center justify-center shadow-[0_0_20px_rgba(0,102,255,0.5)]">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="text-2xl font-extrabold text-[#E6F1FF] tracking-tight">Qiro Sport</span>
        </div>
        <p className="text-[#4D6B9A] text-sm">Create your account to start winning</p>
      </div>

      <Steps current={step} />

      {/* Card */}
      <div className="bg-[#0F1B3D]/80 backdrop-blur-sm border border-[#1A2B4A] rounded-2xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">

        {/* Error banner */}
        {serverError && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 text-sm text-[#EF4444] mb-5">
            {serverError}
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <form onSubmit={handleSubmit(onStep1)} className="flex flex-col gap-4">
            <h2 className="text-base font-bold text-[#E6F1FF]">Account Details</h2>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="08012345678"
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-10 pr-4 py-3 text-[#E6F1FF] text-sm placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all"
                />
              </div>
              {errors.phone && <p className="text-xs text-[#EF4444]">{errors.phone.message}</p>}
            </div>

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
                <input
                  {...register('username')}
                  placeholder="e.g. BetKing99"
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-10 pr-4 py-3 text-[#E6F1FF] text-sm placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all"
                />
              </div>
              {errors.username && <p className="text-xs text-[#EF4444]">{errors.username.message}</p>}
            </div>

            {/* DOB */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Date of Birth</label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
                <input
                  {...register('dob')}
                  type="date"
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-10 pr-4 py-3 text-[#E6F1FF] text-sm focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all [color-scheme:dark]"
                />
              </div>
              {errors.dob && <p className="text-xs text-[#EF4444]">{errors.dob.message}</p>}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-10 pr-11 py-3 text-[#E6F1FF] text-sm placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-[#EF4444]">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Confirm Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-10 pr-11 py-3 text-[#E6F1FF] text-sm placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-[#EF4444]">{errors.confirmPassword.message}</p>}
            </div>

            <p className="text-[10px] text-[#4D6B9A]">
              By registering you agree to our Terms of Service. You must be 18+ to use Qiro Sport.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#0066FF] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,102,255,0.4)] hover:shadow-[0_0_30px_rgba(0,102,255,0.6)] hover:bg-[#0052CC] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : 'Continue'}
            </button>
          </form>
        )}

        {/* ── Step 2 — OTP ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h2 className="text-base font-bold text-[#E6F1FF]">Verify your number</h2>
                <p className="text-xs text-[#4D6B9A]">Code sent to {phone.slice(0, 4)}****{phone.slice(-3)}</p>
              </div>
            </div>

            <OtpInput value={otp} onChange={setOtp} />

            <button
              onClick={onVerifyOtp}
              disabled={isSubmitting || otp.length < 6}
              className="w-full h-12 bg-[#0066FF] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,102,255,0.4)] hover:shadow-[0_0_30px_rgba(0,102,255,0.6)] hover:bg-[#0052CC] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : 'Verify & Create Account'}
            </button>

            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-sm text-[#4D6B9A]">Resend in <span className="text-[#0066FF] font-semibold">{resendCooldown}s</span></p>
              ) : (
                <button onClick={resendOtp} className="text-sm text-[#0066FF] font-semibold hover:text-[#00D4FF] transition-colors">
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-[#4D6B9A]">
        Already have an account?{' '}
        <Link href="/login" className="text-[#0066FF] font-semibold hover:text-[#00D4FF] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
