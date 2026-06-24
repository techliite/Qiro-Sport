'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, RefreshCw, Trophy, Dices, Settings, Globe, AlertCircle, CheckCircle } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { cn } from '@qiro/ui'

interface GameConfig {
  gameType: string
  key: string
  value: string
}

type ConfigMap = Record<string, Record<string, string>>

const DEFAULTS: ConfigMap = {
  GLOBAL: {
    min_stake_kobo: '10000',
    max_stake_kobo: '5000000',
    max_win_kobo:   '100000000',
  },
  VIRTUAL_FOOTBALL: {
    house_edge:        '0.08',
    round_duration_ms: '300000',
    suspended:         'false',
  },
  DICE: {
    house_edge: '0.02',
    suspended:  'false',
  },
  HORSE_RACING: {
    house_edge: '0.10',
    suspended:  'true',
  },
}

const GAME_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  GLOBAL:           { label: 'Global',          icon: Globe,    color: 'text-[#E6F1FF] bg-[#1A2B4A]' },
  VIRTUAL_FOOTBALL: { label: 'Virtual Football', icon: Trophy,   color: 'text-[#0066FF] bg-[#0066FF]/10' },
  DICE:             { label: 'Dice',             icon: Dices,    color: 'text-[#00D4FF] bg-[#00D4FF]/10' },
  HORSE_RACING:     { label: 'Horse Racing',     icon: Settings, color: 'text-[#F59E0B] bg-[#F59E0B]/10' },
}

const KEY_LABELS: Record<string, { label: string; hint: string; type: 'number' | 'boolean' | 'duration' }> = {
  min_stake_kobo:    { label: 'Min Stake (kobo)',     hint: '10000 = ₦100',        type: 'number' },
  max_stake_kobo:    { label: 'Max Stake (kobo)',     hint: '5000000 = ₦50,000',   type: 'number' },
  max_win_kobo:      { label: 'Max Win (kobo)',       hint: '100000000 = ₦1M',     type: 'number' },
  house_edge:        { label: 'House Edge',           hint: '0.08 = 8%',           type: 'number' },
  round_duration_ms: { label: 'Round Duration (ms)',  hint: '300000 = 5 min',      type: 'duration' },
  suspended:         { label: 'Suspended',            hint: 'true = game is off',  type: 'boolean' },
}

function mergeWithDefaults(remoteRows: GameConfig[]): ConfigMap {
  const map: ConfigMap = JSON.parse(JSON.stringify(DEFAULTS))
  for (const row of remoteRows) {
    if (!map[row.gameType]) map[row.gameType] = {}
    map[row.gameType][row.key] = row.value
  }
  return map
}

export default function ConfigPage() {
  const [configs, setConfigs]   = useState<ConfigMap>(DEFAULTS)
  const [edits, setEdits]       = useState<ConfigMap>({})
  const [saving, setSaving]     = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [loading, setLoading]   = useState(true)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get<GameConfig[]>('/admin/config')
      setConfigs(mergeWithDefaults(res.data ?? []))
    } catch { setConfigs(DEFAULTS) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const getValue = (gameType: string, key: string) =>
    edits[gameType]?.[key] ?? configs[gameType]?.[key] ?? ''

  const handleChange = (gameType: string, key: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [gameType]: { ...prev[gameType], [key]: value },
    }))
  }

  const handleSave = async (gameType: string, key: string) => {
    const value = getValue(gameType, key)
    const saveKey = `${gameType}.${key}`
    setSaving(saveKey)
    try {
      await adminApi.patch('/admin/config', { gameType, key, value })
      setConfigs((prev) => ({
        ...prev,
        [gameType]: { ...prev[gameType], [key]: value },
      }))
      setEdits((prev) => {
        const next = { ...prev }
        if (next[gameType]) {
          delete next[gameType][key]
          if (!Object.keys(next[gameType]).length) delete next[gameType]
        }
        return next
      })
      showToast(`Saved ${KEY_LABELS[key]?.label ?? key}`, true)
    } catch { showToast('Save failed', false) }
    finally { setSaving(null) }
  }

  const isDirty = (gameType: string, key: string) =>
    edits[gameType]?.[key] !== undefined && edits[gameType][key] !== configs[gameType]?.[key]

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#E6F1FF]">Game Config</h1>
          <p className="text-sm text-[#4D6B9A] mt-0.5">Adjust stakes, edges & suspensions per game</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 border border-[#1A2B4A] text-[#4D6B9A] hover:text-[#E6F1FF] hover:border-[#0066FF]/40 rounded-xl text-sm font-semibold transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 bg-[#0F1B3D] rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(DEFAULTS).map(([gameType, keys]) => {
            const meta = GAME_META[gameType]
            const Icon = meta.icon
            return (
              <div key={gameType} className="bg-[#0F1B3D] border border-[#1A2B4A] rounded-2xl overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1A2B4A]">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', meta.color)}>
                    <Icon size={14} />
                  </div>
                  <span className="text-sm font-bold text-[#E6F1FF]">{meta.label}</span>
                  {configs[gameType]?.suspended === 'true' && (
                    <span className="ml-auto text-[9px] font-black px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 rounded-md">SUSPENDED</span>
                  )}
                </div>

                {/* Config rows */}
                <div className="divide-y divide-[#0F1B3D]">
                  {Object.keys(keys).map((key) => {
                    const meta2 = KEY_LABELS[key]
                    const val = getValue(gameType, key)
                    const dirty = isDirty(gameType, key)
                    const saveKey = `${gameType}.${key}`

                    return (
                      <div key={key} className="flex items-center gap-4 px-5 py-3 hover:bg-[#081226]/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#E6F1FF]">{meta2?.label ?? key}</p>
                          <p className="text-[10px] text-[#4D6B9A]">{meta2?.hint}</p>
                        </div>

                        {meta2?.type === 'boolean' ? (
                          <button
                            onClick={() => {
                              const next = val === 'true' ? 'false' : 'true'
                              handleChange(gameType, key, next)
                              setTimeout(() => handleSave(gameType, key), 0)
                            }}
                            className={cn(
                              'relative w-10 h-5 rounded-full border transition-all shrink-0',
                              val === 'true' ? 'bg-[#EF4444]/20 border-[#EF4444]/40' : 'bg-[#00C48C]/20 border-[#00C48C]/40',
                            )}
                          >
                            <span className={cn('absolute top-0.5 w-4 h-4 rounded-full transition-all', val === 'true' ? 'left-5 bg-[#EF4444]' : 'left-0.5 bg-[#00C48C]')} />
                          </button>
                        ) : (
                          <input
                            value={val}
                            onChange={(e) => handleChange(gameType, key, e.target.value)}
                            className="w-36 bg-[#081226] border border-[#1A2B4A] text-[#E6F1FF] text-sm font-mono rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#0066FF] transition-all"
                          />
                        )}

                        {meta2?.type !== 'boolean' && (
                          <button
                            onClick={() => handleSave(gameType, key)}
                            disabled={!dirty || saving === saveKey}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0',
                              dirty
                                ? 'bg-[#0066FF] border-[#0066FF] text-white hover:bg-[#0052CC]'
                                : 'border-[#1A2B4A] text-[#2A4070] cursor-not-allowed',
                            )}
                          >
                            <Save size={11} />
                            {saving === saveKey ? 'Saving…' : 'Save'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl text-sm font-semibold transition-all',
          toast.ok
            ? 'bg-[#00C48C]/10 border-[#00C48C]/30 text-[#00C48C]'
            : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]',
        )}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
