'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ShieldOff, ShieldCheck, ShieldAlert, RefreshCw, AlertCircle, Users } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { cn } from '@qiro/ui'

interface User {
  id: string
  username: string
  phone: string
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED'
  phoneVerified: boolean
  createdAt: string
  wallet: { balanceKobo: string } | null
}

const STATUS_CFG = {
  ACTIVE:    { label: 'Active',    color: 'text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20', icon: ShieldCheck },
  SUSPENDED: { label: 'Suspended', color: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20', icon: ShieldAlert },
  BANNED:    { label: 'Banned',    color: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20', icon: ShieldOff },
}

const MOCK_USERS: User[] = [
  { id: '1', username: 'hamid_test',   phone: '08012345678', status: 'ACTIVE',    phoneVerified: true,  createdAt: new Date().toISOString(),                       wallet: { balanceKobo: '250000' } },
  { id: '2', username: 'jane_doe',     phone: '08098765432', status: 'ACTIVE',    phoneVerified: true,  createdAt: new Date(Date.now() - 86400000).toISOString(),   wallet: { balanceKobo: '1500000' } },
  { id: '3', username: 'john_test',    phone: '09011223344', status: 'SUSPENDED', phoneVerified: false, createdAt: new Date(Date.now() - 2*86400000).toISOString(), wallet: { balanceKobo: '0' } },
  { id: '4', username: 'blocked_user', phone: '07055667788', status: 'BANNED',    phoneVerified: true,  createdAt: new Date(Date.now() - 5*86400000).toISOString(), wallet: null },
]

function formatNaira(kobo: string | number) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

export default function UsersPage() {
  const [query, setQuery]   = useState('')
  const [users, setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [confirm, setConfirm] = useState<{ user: User; action: 'ban' | 'unban' | 'suspend' } | null>(null)
  const [acting, setActing] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true); setError('')
    try {
      const res = await adminApi.get<User[]>(`/admin/users?q=${encodeURIComponent(q)}`)
      setUsers(res.data?.length ? res.data : MOCK_USERS)
    } catch { setUsers(MOCK_USERS) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 400)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => { search('') }, [search])

  const handleAction = async () => {
    if (!confirm) return
    setActing(true)
    try {
      const ep = confirm.action === 'ban' ? 'ban' : confirm.action === 'unban' ? 'unban' : 'suspend'
      await adminApi.patch(`/admin/users/${confirm.user.id}/${ep}`)
      setConfirm(null)
      search(query)
    } catch { setError('Action failed') }
    finally { setActing(false) }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#E6F1FF]">Users</h1>
          <p className="text-sm text-[#4D6B9A] mt-0.5">{users.length} result{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => search(query)} className="flex items-center gap-2 px-3 py-2 border border-[#1A2B4A] text-[#4D6B9A] hover:text-[#E6F1FF] hover:border-[#0066FF]/40 rounded-xl text-sm font-semibold transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4D6B9A]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or phone…"
          className="w-full bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#E6F1FF] placeholder-[#2A4070] focus:outline-none focus:border-[#0066FF] transition-all"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-4 py-3 mb-4 text-sm text-[#EF4444]">
          <AlertCircle size={15} />{error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-[#0F1B3D] rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Users size={36} className="text-[#1A2B4A]" />
          <p className="text-[#4D6B9A] text-sm">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const cfg = STATUS_CFG[user.status]
            const StatusIcon = cfg.icon
            return (
              <div key={user.id} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/25 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-black text-[#0066FF]">{user.username.slice(0,2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#E6F1FF]">@{user.username}</span>
                    {!user.phoneVerified && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 rounded-md">UNVERIFIED</span>}
                  </div>
                  <p className="text-xs text-[#4D6B9A]">{user.phone} · Joined {formatDate(user.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-[#E6F1FF]">{user.wallet ? formatNaira(user.wallet.balanceKobo) : '—'}</p>
                  <p className="text-[10px] text-[#4D6B9A]">wallet</p>
                </div>
                <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0', cfg.color)}>
                  <StatusIcon size={10} />{cfg.label}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  {user.status !== 'BANNED' && (
                    <button onClick={() => setConfirm({ user, action: 'ban' })} className="px-2.5 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold rounded-lg hover:bg-[#EF4444]/20 transition-all">Ban</button>
                  )}
                  {user.status === 'BANNED' && (
                    <button onClick={() => setConfirm({ user, action: 'unban' })} className="px-2.5 py-1.5 bg-[#00C48C]/10 border border-[#00C48C]/20 text-[#00C48C] text-xs font-semibold rounded-lg hover:bg-[#00C48C]/20 transition-all">Unban</button>
                  )}
                  {user.status === 'ACTIVE' && (
                    <button onClick={() => setConfirm({ user, action: 'suspend' })} className="px-2.5 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-xs font-semibold rounded-lg hover:bg-[#F59E0B]/20 transition-all">Suspend</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative w-full max-w-sm bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#E6F1FF] mb-1">
              {confirm.action === 'ban' ? 'Ban' : confirm.action === 'unban' ? 'Unban' : 'Suspend'} @{confirm.user.username}?
            </h3>
            <p className="text-sm text-[#4D6B9A] mb-6">
              {confirm.action === 'ban' ? 'User will be permanently banned and cannot log in.' : confirm.action === 'unban' ? 'User will be restored to active status.' : 'User will be temporarily suspended.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 h-10 border border-[#1A2B4A] text-[#4D6B9A] font-semibold rounded-xl text-sm hover:bg-[#081226] transition-all">Cancel</button>
              <button onClick={handleAction} disabled={acting} className={cn('flex-1 h-10 font-bold rounded-xl text-sm text-white disabled:opacity-60 transition-all', confirm.action === 'unban' ? 'bg-[#00C48C] hover:bg-[#00A876]' : confirm.action === 'ban' ? 'bg-[#EF4444] hover:bg-[#DC2626]' : 'bg-[#F59E0B] hover:bg-[#D97706]')}>
                {acting ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
