import { useStudents } from '@/lib/frappe/students'
import { useInvoices } from '@/lib/frappe/invoices'
import { useReceipts } from '@/lib/frappe/receipts'
import { useDebtorCases } from '@/lib/frappe/debtor-cases'
import { usePaymentVouchers } from '@/lib/frappe/payment-vouchers'
import { useFixedAssets } from '@/lib/frappe/fixed-assets'
import { formatUSD } from '@/lib/currency'
import { formatStudentName } from '@/lib/utils'

export interface SearchEntry {
  type: string
  id: string
  label: string
  subtitle: string
  route: string
}

/** Cross-entity search index for the Bursar's ⌘K (AUD-025) -- the six
 * entities the brief names by name. Most of these entities are viewed via
 * a modal from their list page rather than a dedicated detail route (this
 * app's established "mutating actions always go through a Dialog, never a
 * full-page route" convention extends to viewing too for these), so a
 * match routes to the entity's list page, not a deep link to the record
 * itself -- Students is the one exception with a real detail route.
 *
 * `enabled` gates every underlying query so a non-Bursar shell's command
 * menu never fetches Bursar-only data (extra requests, possible RBAC
 * errors) -- queries share their cache key with the equivalent Bursar
 * list pages, so opening ⌘K there is usually a cache hit, not a fetch. */
export function useBursarSearchIndex(enabled: boolean): SearchEntry[] {
  const { data: students } = useStudents({ enabled })
  const { data: invoices } = useInvoices({ enabled })
  const { data: receipts } = useReceipts({ enabled })
  const { data: debtorCases } = useDebtorCases({ enabled })
  const { data: paymentVouchers } = usePaymentVouchers({ enabled })
  const { data: fixedAssets } = useFixedAssets({ enabled })

  if (!enabled) return []

  const studentNames = new Map((students ?? []).map((s) => [s.name, formatStudentName(s.first_name, s.last_name)]))

  return [
    ...(students ?? []).map((s) => ({
      type: 'Students',
      id: s.name,
      label: formatStudentName(s.first_name, s.last_name),
      subtitle: `${s.name} · ${s.grade ?? s.academic_year}`,
      route: `/bursar/students/${s.name}`,
    })),
    ...(invoices ?? []).map((inv) => ({
      type: 'Invoices',
      id: inv.name,
      label: `${inv.name} · ${studentNames.get(inv.student) ?? inv.student}`,
      subtitle: `${inv.term} · ${formatUSD(inv.outstanding_amount)} outstanding`,
      route: '/bursar/billing/invoices',
    })),
    ...(receipts ?? []).map((r) => ({
      type: 'Receipts',
      id: r.name,
      label: `${r.name} · ${studentNames.get(r.student) ?? r.student}`,
      subtitle: `${r.payment_method} · ${formatUSD(r.amount)}`,
      route: '/bursar/payment-desk/receipts',
    })),
    ...(debtorCases ?? []).map((c) => ({
      type: 'Debtor Cases',
      id: c.name,
      label: `${studentNames.get(c.student) ?? c.student} · ${c.name}`,
      subtitle: `${c.ageing_bucket} · ${formatUSD(c.outstanding_amount)}`,
      route: '/bursar/debtors/cases',
    })),
    ...(paymentVouchers ?? []).map((v) => ({
      type: 'Payment Vouchers',
      id: v.name,
      label: v.name,
      subtitle: `${v.workflow_state} · ${formatUSD(v.amount)}`,
      route: '/bursar/procurement/payment-vouchers',
    })),
    ...(fixedAssets ?? []).map((a) => ({
      type: 'Fixed Assets',
      id: a.name,
      label: a.description,
      subtitle: `${a.asset_code} · ${formatUSD(a.net_book_value)}`,
      route: '/bursar/finance/fixed-assets',
    })),
  ]
}
