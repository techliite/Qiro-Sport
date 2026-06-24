'use client'

import { useToastStore, type Toast } from '@/store/toast.store'
import { Trophy, TrendingDown, X } from 'lucide-react'

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const isWin  = toast.type === 'win'
  const isLoss = toast.type === 'loss'

  const icon = isWin
    ? <Trophy size={16} className="text-accent" />
    : isLoss
      ? <TrendingDown size={16} className="text-danger" />
      : null

  const borderColor = isWin ? 'border-accent/30' : isLoss ? 'border-danger/20' : 'border-border'
  const glowColor   = isWin ? 'shadow-[0_0_20px_rgba(0,212,255,0.15)]' : ''

  return (
    <div className={`flex items-start gap-3 w-full bg-surface border ${borderColor} rounded-2xl px-4 py-3.5 ${glowColor}`}>
      {icon && (
        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isWin ? 'bg-accent/10' : 'bg-danger/10'}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary">{toast.title}</p>
        {toast.body && <p className="text-xs text-text-secondary mt-0.5">{toast.body}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="text-text-secondary hover:text-text-primary transition-colors mt-0.5 shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function BetToast() {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 inset-x-4 sm:left-auto sm:right-4 sm:w-80 z-200 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
