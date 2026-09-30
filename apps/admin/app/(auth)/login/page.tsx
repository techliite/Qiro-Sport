'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, AlertCircle } from 'lucide-react'
import { adminApi, ADMIN_TOKEN_KEY, getApiError } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Already signed in — skip the form
  useEffect(() => {
    if (localStorage.getItem(ADMIN_TOKEN_KEY)) router.replace('/withdrawals')
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await adminApi.post<{ accessToken: string }>('/admin/auth/login', { username, password })
      localStorage.setItem(ADMIN_TOKEN_KEY, data.accessToken)
      router.replace('/withdrawals')
    } catch (err) {
      setError(getApiError(err, 'Login failed'))
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-[#0066FF]" style={{ textShadow: '0 0 12px rgba(0,102,255,0.5)' }}>
            Qiro Sport
          </h1>
          <p className="text-sm text-[#4D6B9A]">Operator Access</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0F1B3D] rounded-2xl p-6 border border-[#1A2B4A] flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="w-full h-11 bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 text-sm text-[#E6F1FF] placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-[#4D6B9A] uppercase tracking-wider">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full h-11 bg-[#081226] border border-[#1A2B4A] rounded-xl px-3 text-sm text-[#E6F1FF] placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="h-11 mt-1 flex items-center justify-center gap-2 bg-[#0066FF] text-white font-semibold rounded-xl hover:bg-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            <Lock size={15} />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
