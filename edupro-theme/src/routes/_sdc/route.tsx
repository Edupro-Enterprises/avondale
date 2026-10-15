import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/frappe/route-guard'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { sdcSidebarData } from '@/components/layout/data/sdc-sidebar-data'

export const Route = createFileRoute('/_sdc')({
  beforeLoad: requireRole('SDC Chairperson/Treasurer'),
  component: () => <AuthenticatedLayout sidebarData={sdcSidebarData} />,
})
