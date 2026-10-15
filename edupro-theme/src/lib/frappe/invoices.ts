/** Invoice doctype access -- see the backend repo's
 * edupro_school_fees/doctype/invoice/invoice.json. Invoice is submittable
 * (docstatus 0 draft / 1 submitted / 2 cancelled) -- only submitted
 * invoices are real, issued bills, matching the docstatus=1 filter the
 * old web/ frontend always applied (lib/staff.ts's listAllInvoices). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeInvoice {
  name: string
  student: string
  total_amount: number
  outstanding_amount: number
  due_date?: string
  posting_date: string
  status: 'Unpaid' | 'Partly Paid' | 'Paid' | 'Cancelled' | 'Consolidated'
  academic_year: string
  term: string
}

export interface FrappeInvoiceLine {
  name: string
  fee_item: string
  description?: string
  currency: 'ZiG' | 'USD'
  amount: number
  account?: string
  beneficiary_category?: string
  is_brought_forward: 0 | 1
  is_advance_applied: 0 | 1
}

export interface FrappeInvoiceDetail extends FrappeInvoice {
  fee_structure: string
  items: FrappeInvoiceLine[]
  owner: string
}

const INVOICE_FIELDS = [
  'name',
  'student',
  'total_amount',
  'outstanding_amount',
  'due_date',
  'posting_date',
  'status',
  'academic_year',
  'term',
]

export function useInvoices(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['invoices'],
    enabled: options?.enabled,
    queryFn: async () => {
      const res = await listResource<FrappeInvoice>('Invoice', {
        fields: JSON.stringify(INVOICE_FIELDS),
        filters: JSON.stringify([['docstatus', '=', 1]]),
        order_by: 'posting_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useInvoice(name: string | undefined) {
  return useQuery({
    queryKey: ['invoice', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeInvoiceDetail }>(
          `/api/resource/Invoice/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}

export function useStudentInvoices(studentId: string) {
  return useQuery({
    queryKey: ['invoices', 'student', studentId],
    queryFn: async () => {
      const res = await listResource<FrappeInvoice>('Invoice', {
        fields: JSON.stringify(INVOICE_FIELDS),
        filters: JSON.stringify([
          ['student', '=', studentId],
          ['docstatus', '=', 1],
        ]),
        order_by: 'posting_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
    enabled: !!studentId,
  })
}

export interface BatchInvoicingResult {
  created: Array<{ invoice: string; student: string }>
  skipped_existing: string[]
  failed: Array<{ student: string; error: string }>
}

/** Invoices every eligible Active student against an Approved Fee Structure
 * in one call -- mirrors the old web/ frontend's staff.ts::runBatchInvoicing,
 * the only place this whitelisted method was previously called from.
 * Students already invoiced against this exact Fee Structure are skipped
 * server-side, so re-running is always safe. */
export function useRunBatchInvoicing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ feeStructure, grade }: { feeStructure: string; grade?: string }) => {
      const res = await api.post<{ message: BatchInvoicingResult }>(
        '/api/method/edupro_school_fees.edupro_school_fees.doctype.invoice.invoice.run_batch_invoicing',
        { fee_structure: feeStructure, grade: grade || undefined }
      )
      return res.message
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export interface EmailInvoicesResult {
  sent: string[]
  skipped_no_guardian_email: string[]
}

/** Emails each Invoice (as a PDF attachment, built server-side) to its
 * student's guardian -- pass a single name for one-off use, or the whole
 * batch-invoicing result for "Email all". */
export function useEmailInvoices() {
  return useMutation({
    mutationFn: async (invoiceNames: string[]) =>
      (
        await api.post<{ message: EmailInvoicesResult }>(
          '/api/method/edupro_school_fees.edupro_school_fees.doctype.invoice.invoice.email_invoices',
          { invoice_names: invoiceNames }
        )
      ).message,
  })
}

export type FeeStatus = 'paid' | 'partial' | 'overdue' | 'pending'

/** Derives the roster's "fee status" badge from real Invoice rows -- the
 * Student doctype's own `status` field is enrollment status (Active/
 * Suspended/...), not payment status, so this is computed rather than
 * read directly. paidUSD is total invoiced minus what's still outstanding,
 * using the same Consolidated-exclusion as totalInvoiced below (a
 * Consolidated invoice's own total_amount is already re-stated as a
 * "Balance brought forward" line on the invoice that absorbed it -- see
 * student-documents.ts -- so counting it again here would double-count). */
export function computeFeeStatus(invoices: FrappeInvoice[]): {
  status: FeeStatus
  balanceUSD: number
  paidUSD: number
} {
  const active = invoices.filter((inv) => inv.status !== 'Cancelled')
  const balanceUSD = active.reduce((sum, inv) => sum + inv.outstanding_amount, 0)
  const totalInvoiced = active
    .filter((inv) => inv.status !== 'Consolidated')
    .reduce((sum, inv) => sum + inv.total_amount, 0)
  const paidUSD = Math.max(0, totalInvoiced - balanceUSD)

  if (active.length === 0) return { status: 'pending', balanceUSD: 0, paidUSD: 0 }
  if (balanceUSD === 0) return { status: 'paid', balanceUSD, paidUSD }

  const today = new Date().toISOString().slice(0, 10)
  const hasOverdue = active.some(
    (inv) => inv.outstanding_amount > 0 && inv.due_date && inv.due_date < today
  )
  if (hasOverdue) return { status: 'overdue', balanceUSD, paidUSD }

  return { status: balanceUSD < totalInvoiced ? 'partial' : 'pending', balanceUSD, paidUSD }
}
