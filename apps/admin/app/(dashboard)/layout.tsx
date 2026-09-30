import { AdminSidebar, MobileAdminNav } from '@/components/layout/sidebar'
import { AdminAuthGate } from '@/components/providers/admin-auth-gate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGate>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>
        <MobileAdminNav />
      </div>
    </AdminAuthGate>
  )
}
