import { createFileRoute } from '@tanstack/react-router'
import {
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Settings,
  Wallet,
} from 'lucide-react'
import { requireRole } from '@/lib/frappe/route-guard'
import { useCurrentUser } from '@/lib/frappe/auth'
import { useMyGuardian } from '@/lib/frappe/students'
import { PortalLayout } from '@/components/layout/portal-layout'

const parentNavLinks = [
  { title: 'Home', to: '/portal', icon: LayoutDashboard },
  { title: 'Children', to: '/portal/students', icon: CalendarClock },
  { title: 'Pay', to: '/portal/pay', icon: Wallet },
  { title: 'History', to: '/portal/payments', icon: CreditCard },
  { title: 'Settings', to: '/portal/settings', icon: Settings },
]

export const Route = createFileRoute('/_portal')({
  beforeLoad: requireRole('Parent/Guardian'),
  component: ParentShell,
})

function ParentShell() {
  const { user } = useCurrentUser()
  const { data: guardian } = useMyGuardian()

  const displayName = guardian?.full_name ?? user?.full_name ?? ''
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PG'

  return (
    <PortalLayout
      tagline='Parent Portal'
      navLinks={parentNavLinks}
      userName={displayName}
      userEmail={user?.name ?? ''}
      avatarFallback={initials}
      settingsPath='/portal/settings'
    />
  )
}
