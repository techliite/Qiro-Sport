'use client'


import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Phone, Lock, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useWalletStore } from '@/store/wallet.store'

const schema = z.object({
  // Spaces/dashes allowed while typing; the API stores every number as +234XXXXXXXXXX
  phone: z.string().transform((v) => v.replace(/[\s\-()]/g, '')).pipe(z.string().regex(/^\+?234[0-9]{10}$|^0[7-9][0-1][0-9]{8}$/, 'Enter a valid Nigerian number, e.g. 0805 947 2483')),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

interface LoginResponse {
  accessToken: string
  user: { id: string; phone: string; username: string }
}

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setBalance = useWalletStore((s) => s.setBalance)

  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState('')
  const [lockoutMsg, setLockoutMsg] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setServerError('')
    setLockoutMsg('')
    try {
      const res = await api.post<LoginResponse>('/auth/login', data)
      setAuth(res.data.user, res.data.accessToken)

      // Fetch balance in background
      api.get<{ balanceKobo: number }>('/wallet/balance')
        .then((r) => setBalance(r.data.balanceKobo))
        .catch(() => null)

      router.replace('/sports')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong'
      if (msg.toLowerCase().includes('lock')) {
        setLockoutMsg(msg)
      } else {
        setServerError(msg)
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Logo */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#0066FF] flex items-center justify-center shadow-[0_0_20px_rgba(0,102,255,0.5)]">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="text-2xl font-extrabold text-[#E6F1FF] tracking-tight">Qiro Sport</span>
        </div>
        <p className="text-[#4D6B9A] text-sm">Welcome back. Sign in to continue.</p>
      </div>

      {/* Card */}
      <div className="bg-[#0F1B3D]/80 backdrop-blur-sm border border-[#1A2B4A] rounded-2xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

          {/* Lockout banner */}
          {lockoutMsg && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 text-sm text-[#EF4444]">
              {lockoutMsg}
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 text-sm text-[#EF4444]">
              {serverError}
            </div>
          )}

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

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
              <input
                {...register('password')}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full bg-[#081226] border border-[#1A2B4A] rounded-xl pl-10 pr-11 py-3 text-[#E6F1FF] text-sm placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.15)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A] hover:text-[#E6F1FF] transition-colors"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-[#EF4444]">{errors.password.message}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#0066FF] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,102,255,0.4)] hover:shadow-[0_0_30px_rgba(0,102,255,0.6)] hover:bg-[#0052CC] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none mt-1"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-[#4D6B9A]">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-[#0066FF] font-semibold hover:text-[#00D4FF] transition-colors">
          Create account
        </Link>
      </p>
    </div>
  )
}
