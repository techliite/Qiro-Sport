import { BottomNav } from '@/components/layout/bottom-nav'
import { BalanceBanner } from '@/components/layout/balance-banner'
import { SessionBootstrap } from '@/components/layout/session-bootstrap'
import { BetToast } from '@/components/layout/bet-toast'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionBootstrap />
      <BetToast />
      <BalanceBanner />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
