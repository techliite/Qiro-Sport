'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi, ADMIN_TOKEN_KEY } from '@/lib/api'

// Verifies the stored admin session with the API before rendering the dashboard.
// The API enforces auth on every route; this only avoids flashing protected UI.
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
      router.replace('/login')
      return
    }
    // 401 is handled by the adminApi interceptor (clears token, redirects)
    adminApi
      .get('/admin/auth/me')
      .then(() => setVerified(true))
      .catch(() => {
        // Also covers 403 (IP blocked): without clearing, /login would bounce straight back here
        localStorage.removeItem(ADMIN_TOKEN_KEY)
        router.replace('/login')
      })
  }, [router])

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
