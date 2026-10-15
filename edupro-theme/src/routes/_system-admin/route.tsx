import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/frappe/route-guard'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { systemAdminSidebarData } from '@/components/layout/data/system-admin-sidebar-data'

export const Route = createFileRoute('/_system-admin')({
  beforeLoad: requireRole('System Manager'),
  component: () => <AuthenticatedLayout sidebarData={systemAdminSidebarData} />,
})
