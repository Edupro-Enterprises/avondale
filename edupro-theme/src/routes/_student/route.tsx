import { createFileRoute } from '@tanstack/react-router'
import {
  CalendarClock,
  LayoutDashboard,
  ReceiptText,
  Settings,
} from 'lucide-react'
import { requireRole } from '@/lib/frappe/route-guard'
import { useCurrentUser } from '@/lib/frappe/auth'
import { useMyStudent } from '@/lib/frappe/students'
import { PortalLayout } from '@/components/layout/portal-layout'
import { formatStudentName } from '@/lib/utils'

const studentNavLinks = [
  { title: 'Home', to: '/student', icon: LayoutDashboard },
  { title: 'Statement', to: '/student/statement', icon: ReceiptText },
  { title: 'Payment Plan', to: '/student/payment-plan', icon: CalendarClock },
  { title: 'Settings', to: '/student/settings', icon: Settings },
]

export const Route = createFileRoute('/_student')({
  beforeLoad: requireRole('Student'),
  component: StudentShell,
})

function StudentShell() {
  const { user } = useCurrentUser()
  const { data: student } = useMyStudent()

  const displayName = student ? formatStudentName(student.first_name, student.last_name) : (user?.full_name ?? '')
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST'

  return (
    <PortalLayout
      tagline='Student Portal'
      navLinks={studentNavLinks}
      userName={displayName}
      userEmail={user?.name ?? ''}
      avatarFallback={initials}
      settingsPath='/student/settings'
    />
  )
}
