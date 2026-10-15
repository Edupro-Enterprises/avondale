import {
  Banknote,
  Building2,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  RotateCcw,
  Settings,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const schoolHeadSidebarData: SidebarData = {
  teams: [
    {
      name: 'Avondale Primary School',
      logo: GraduationCap,
      plan: 'School Head',
    },
  ],
  navGroups: [
    {
      title: 'Overview',
      items: [{ title: 'Dashboard', url: '/school-head', icon: LayoutDashboard }],
    },
    {
      title: 'Approvals',
      items: [
        { title: 'Payment Vouchers', url: '/school-head/payment-vouchers', icon: FileCheck2 },
        { title: 'Receipt Reversals', url: '/school-head/receipt-reversals', icon: RotateCcw },
        { title: 'Vendors', url: '/school-head/vendors', icon: Building2 },
        { title: 'Cash-Ups', url: '/school-head/cash-ups', icon: Banknote },
        { title: 'MoPSE ED46', url: '/school-head/mopse-ed46', icon: FileCheck2 },
      ],
    },
    {
      title: 'Oversight',
      items: [
        { title: 'Fee Structures', url: '/school-head/fee-structures', icon: FileText },
        { title: 'Budget Vote Book', url: '/school-head/budget-vote-book', icon: PiggyBank },
        { title: 'Students', url: '/school-head/students', icon: Users },
        { title: 'Reports', url: '/school-head/reports', icon: ReceiptText },
      ],
    },
    {
      title: 'Settings',
      items: [{ title: 'Settings', url: '/settings', icon: Settings }],
    },
  ],
}
