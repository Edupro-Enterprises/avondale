import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/frappe/route-guard'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { schoolHeadSidebarData } from '@/components/layout/data/school-head-sidebar-data'

export const Route = createFileRoute('/_school-head')({
  beforeLoad: requireRole('School Head'),
  component: () => <AuthenticatedLayout sidebarData={schoolHeadSidebarData} />,
})
