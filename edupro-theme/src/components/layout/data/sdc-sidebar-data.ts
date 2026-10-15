import {
  BookOpen,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Settings,
  UserRoundX,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sdcSidebarData: SidebarData = {
  teams: [
    {
      name: 'Avondale Primary School',
      logo: GraduationCap,
      plan: 'SDC Chairperson/Treasurer',
    },
  ],
  navGroups: [
    {
      title: 'Overview',
      items: [{ title: 'Dashboard', url: '/sdc', icon: LayoutDashboard }],
    },
    {
      title: 'Fund B — SDC/SDA',
      items: [
        { title: 'Payment Vouchers', url: '/sdc/payment-vouchers', icon: FileCheck2 },
        { title: 'Budget Vote Book', url: '/sdc/budget-vote-book', icon: PiggyBank },
        { title: 'Journal Entries', url: '/sdc/journal-entries', icon: BookOpen },
        { title: 'Debtor Cases', url: '/sdc/debtors', icon: UserRoundX },
      ],
    },
    {
      title: 'Reports & Settings',
      items: [
        { title: 'Reports', url: '/sdc/reports', icon: ReceiptText },
        { title: 'MoPSE ED46', url: '/sdc/mopse-ed46', icon: FileCheck2 },
        { title: 'Settings', url: '/settings', icon: Settings },
      ],
    },
  ],
}
