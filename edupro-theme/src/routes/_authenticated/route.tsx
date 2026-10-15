import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/frappe/route-guard'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: requireRole('Bursar'),
  component: AuthenticatedLayout,
})
