import { BottomNav } from '@/components/layout/bottom-nav'
import { BalanceBanner } from '@/components/layout/balance-banner'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <BalanceBanner />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
