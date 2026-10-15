import {
  GraduationCap,
  History,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const systemAdminSidebarData: SidebarData = {
  teams: [
    {
      name: 'Avondale Primary School',
      logo: GraduationCap,
      plan: 'System Admin',
    },
  ],
  navGroups: [
    {
      title: 'Overview',
      items: [{ title: 'Dashboard', url: '/system-admin', icon: LayoutDashboard }],
    },
    {
      title: 'Access Control',
      items: [
        { title: 'Users', url: '/system-admin/users', icon: Users },
        { title: 'Roles', url: '/system-admin/roles', icon: ShieldCheck },
        { title: 'Sessions', url: '/system-admin/sessions', icon: MonitorSmartphone },
      ],
    },
    {
      title: 'Audit',
      items: [{ title: 'Audit Log', url: '/system-admin/audit-log', icon: History }],
    },
    {
      title: 'Settings',
      items: [{ title: 'Settings', url: '/settings', icon: Settings }],
    },
  ],
}
