/** Phase 7 core financial statements -- ported from the backend repo's
 * proven web/src/lib/reports.ts. Unlike the /api/resource/<doctype> calls
 * elsewhere in this app, these hit purpose-built whitelisted methods in
 * edupro_school_fees/reports.py and statutory_reports_extra.py --
 * aggregation (Dr/Cr per account, FX-normalized via each Journal Entry
 * Account row's own snapshotted exchange_rate) happens server-side, the
 * same way Bank Reconciliation's balance_per_cashbook does. Role-gating
 * is enforced inside those modules, not here. */
import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface ReceiptsPaymentsLine {
  source: string
  amount: number
}

export interface ReceiptsAndPayments {
  from_date: string
  to_date: string
  receipt_lines: ReceiptsPaymentsLine[]
  payment_lines: ReceiptsPaymentsLine[]
  total_receipts: number
  total_payments: number
  net_movement: number
  total_receipts_usd: number | null
  total_payments_usd: number | null
  net_movement_usd: number | null
}

export function useReceiptsAndPayments(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['report', 'receipts-and-payments', fromDate, toDate],
    queryFn: async () =>
      (
        await api.get<{ message: ReceiptsAndPayments }>(
          `/api/method/edupro_school_fees.reports.get_receipts_and_payments?from_date=${fromDate}&to_date=${toDate}`
        )
      ).message,
    enabled: !!fromDate && !!toDate,
  })
}

export interface LedgerLine {
  account: string
  fund: string
  amount: number
}

export interface ComprehensiveIncome {
  from_date: string
  to_date: string
  income_lines: LedgerLine[]
  expense_lines: LedgerLine[]
  total_income: number
  total_expense: number
  surplus_deficit: number
  total_income_usd: number | null
  total_expense_usd: number | null
  surplus_deficit_usd: number | null
}

export function useComprehensiveIncome(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['report', 'comprehensive-income', fromDate, toDate],
    queryFn: async () =>
      (
        await api.get<{ message: ComprehensiveIncome }>(
          `/api/method/edupro_school_fees.reports.get_comprehensive_income?from_date=${fromDate}&to_date=${toDate}`
        )
      ).message,
    enabled: !!fromDate && !!toDate,
  })
}

export interface FinancialPosition {
  as_of_date: string
  asset_lines: LedgerLine[]
  liability_lines: LedgerLine[]
  equity_lines: LedgerLine[]
  total_assets: number
  total_liabilities: number
  total_equity_recorded: number
  unclosed_surplus_deficit: number
  accumulated_funds: number
  is_balanced: boolean
  imbalance_amount: number
  total_assets_usd: number | null
  total_liabilities_usd: number | null
  accumulated_funds_usd: number | null
}

export function useFinancialPosition(asOfDate: string) {
  return useQuery({
    queryKey: ['report', 'financial-position', asOfDate],
    queryFn: async () =>
      (
        await api.get<{ message: FinancialPosition }>(
          `/api/method/edupro_school_fees.reports.get_financial_position?as_of_date=${asOfDate}`
        )
      ).message,
    enabled: !!asOfDate,
  })
}

export interface TrialBalanceLine {
  account: string
  account_type: string
  currency: string
  native_debit: number
  native_credit: number
  base_debit: number
  base_credit: number
  usd_debit: number | null
  usd_credit: number | null
}

export interface TrialBalance {
  as_of_date: string
  base_currency: string
  lines: TrialBalanceLine[]
  total_base_debit: number
  total_base_credit: number
  total_usd_debit: number | null
  total_usd_credit: number | null
}

const EXTRA = 'edupro_school_fees.statutory_reports_extra'

export function useTrialBalance(asOfDate?: string) {
  return useQuery({
    queryKey: ['report', 'trial-balance', asOfDate],
    queryFn: async () =>
      (
        await api.get<{ message: TrialBalance }>(
          `/api/method/${EXTRA}.get_multi_currency_trial_balance${asOfDate ? `?as_of_date=${asOfDate}` : ''}`
        )
      ).message,
  })
}

export interface CashBookLine {
  voucher_no: string
  posting_date: string
  reference_doctype: string | null
  reference_name: string | null
  description: string | null
  debit: number
  credit: number
  balance: number
}

export interface CashBook {
  accounts: string[]
  account: string | null
  from_date: string
  to_date: string
  opening_balance: number
  lines: CashBookLine[]
  closing_balance: number
}

export function useCashBook(account: string | undefined, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['report', 'cash-book', account, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate })
      if (account) params.set('account', account)
      return (
        await api.get<{ message: CashBook }>(`/api/method/edupro_school_fees.reports.get_cash_book?${params}`)
      ).message
    },
    enabled: !!fromDate && !!toDate,
  })
}

export interface FixedAssetsDisposalRow {
  asset_code: string
  description: string
  praz_reference: string | null
  date_acquired: string
  historical_cost: number
  currency: string
  accumulated_depreciation: number
  net_book_value: number
  physical_location: string | null
  condition: string
  disposal_status: string
  disposal_date: string | null
  disposal_praz_reference: string | null
}

export interface FixedAssetsDisposalRegister {
  assets: FixedAssetsDisposalRow[]
  disposals: FixedAssetsDisposalRow[]
  total_assets: number
  total_in_use: number
  total_disposed: number
  total_historical_cost: number
  total_accumulated_depreciation: number
  total_net_book_value: number
}

export function useFixedAssetsDisposalRegister() {
  return useQuery({
    queryKey: ['report', 'fixed-assets-disposal-register'],
    queryFn: async () =>
      (await api.get<{ message: FixedAssetsDisposalRegister }>(`/api/method/${EXTRA}.get_fixed_assets_disposal_register`)).message,
  })
}

export interface OutstandingFeesRow {
  student: string
  first_name: string
  last_name: string
  grade: string | null
  guardian: string | null
  guardian_name: string | null
  invoice_count: number
  total_invoiced: number
  total_paid: number
  outstanding_amount: number
  last_payment_date: string | null
}

export interface OutstandingFeesReport {
  academic_year: string | null
  grade: string | null
  rows: OutstandingFeesRow[]
  student_count: number
  total_outstanding: number
  by_grade: Record<string, number>
}

/** Every student with a still-open Invoice, school-wide -- broader than
 * Debtor Cases (which only covers students someone already opened a case
 * for). Had no frontend hook at all before; the Debtor Cases "New case"
 * picker is its first real use, so a Bursar sees who actually owes money
 * (and how much) instead of picking blind from the full student roster. */
export function useOutstandingFeesReport() {
  return useQuery({
    queryKey: ['report', 'outstanding-fees'],
    queryFn: async () =>
      (await api.get<{ message: OutstandingFeesReport }>('/api/method/edupro_school_fees.reports.get_outstanding_fees_report')).message,
  })
}
