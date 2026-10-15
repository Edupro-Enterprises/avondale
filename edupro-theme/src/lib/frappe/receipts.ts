/** Receipt doctype access -- see the backend repo's
 * edupro_school_fees/doctype/receipt/receipt.json and
 * docs/decisions/0015-receipt-reversal-workflow.md. Receipt is submittable;
 * only submitted receipts (docstatus=1) are real, posted payments, matching
 * the old web/ frontend's listAllReceipts filter. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeReceipt {
  name: string
  student: string
  invoice?: string
  payment_method: string
  currency: 'ZiG' | 'USD'
  amount: number
  posting_date: string
  status: 'Submitted' | 'Reversed'
  allocation_type?: 'Current' | 'Arrears' | 'Advance'
  payer_type?: 'Parent Guardian' | 'Sponsor'
  payer?: string
  external_reference?: string
  received_by?: string
  integrity_hash?: string
}

const RECEIPT_FIELDS = [
  'name',
  'student',
  'invoice',
  'payment_method',
  'currency',
  'amount',
  'posting_date',
  'status',
  'allocation_type',
  'payer_type',
  'payer',
  'external_reference',
  'received_by',
  'integrity_hash',
]

export function useReceipts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['receipts'],
    enabled: options?.enabled,
    queryFn: async () => {
      const res = await listResource<FrappeReceipt>('Receipt', {
        fields: JSON.stringify(RECEIPT_FIELDS),
        filters: JSON.stringify([['docstatus', '=', 1]]),
        order_by: 'posting_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useStudentReceipts(studentId: string | undefined) {
  return useQuery({
    queryKey: ['receipts', 'student', studentId],
    queryFn: async () => {
      const res = await listResource<FrappeReceipt>('Receipt', {
        fields: JSON.stringify(RECEIPT_FIELDS),
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

export interface FrappeReceiptDetail extends FrappeReceipt {
  narration?: string
  integrity_hash?: string
  reversal_of?: string
  reversal_reason?: string
  reversal_approved_by?: string
  reversal_approved_on?: string
  received_by: string
  owner: string
}

export function useReceipt(name: string | undefined) {
  return useQuery({
    queryKey: ['receipt', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeReceiptDetail }>(
          `/api/resource/Receipt/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}

export type PaymentMethodType = 'Cash' | 'Bank Transfer' | 'EcoCash'

export interface FrappePaymentMethod {
  name: string
  method_name: string
  method_type: PaymentMethodType
  currency: 'ZiG' | 'USD'
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await listResource<FrappePaymentMethod>('Payment Method', {
        fields: JSON.stringify(['name', 'method_name', 'method_type', 'currency']),
        order_by: 'method_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface InvoiceLineBalance {
  fee_item: string
  total: number
  paid: number
  outstanding: number
  currency: 'ZiG' | 'USD'
}

/** Per-Fee-Item paid/outstanding breakdown of an Invoice, for the Payment
 * Desk's allocation UI -- see get_invoice_line_balances() in the backend's
 * receipt.py. Distinct from Invoice.outstanding_amount, which is one lump
 * figure across every line. */
export function useInvoiceLineBalances(invoice: string | undefined) {
  return useQuery({
    queryKey: ['invoice-line-balances', invoice],
    queryFn: async () =>
      (
        await api.get<{ message: InvoiceLineBalance[] }>(
          `/api/method/${RECEIPT_MODULE}.get_invoice_line_balances?invoice=${encodeURIComponent(invoice!)}`
        )
      ).message,
    enabled: !!invoice,
  })
}

export interface PendingReceiptReversal {
  name: string
  student: string
  invoice: string
  amount: number
  currency: string
  reversal_of: string
  reversal_reason: string
  owner: string
  creation: string
}

const RECEIPT_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.receipt.receipt'

export interface ReceiptVerification {
  valid: boolean
  reason?: string
  receipt?: string
  student?: string
  amount?: number
  currency?: string
  posting_date?: string
}

/** Recomputes the receipt's integrity hash server-side from its current
 * field values and compares -- see verify_receipt() in the backend's
 * receipt.py. Guest-accessible by design (a parent scanning a printed
 * receipt's QR shouldn't have to sign in first) -- but `token` (the
 * receipt's own integrity_hash, carried by the QR/link, see export.ts's
 * verificationUrl) is mandatory: without it the endpoint returns nothing,
 * so a bare receipt name can no longer be walked to enumerate every
 * student's name/amount/date. */
export function useVerifyReceipt(receiptName: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: ['receipt-verification', receiptName, token],
    queryFn: async () =>
      (
        await api.get<{ message: ReceiptVerification }>(
          `/api/method/${RECEIPT_MODULE}.verify_receipt?receipt=${encodeURIComponent(receiptName!)}&token=${encodeURIComponent(token!)}`
        )
      ).message,
    enabled: !!receiptName && !!token,
    retry: false,
  })
}

export function usePendingReceiptReversals() {
  return useQuery({
    queryKey: ['receipt-reversals', 'pending'],
    queryFn: async () =>
      (
        await api.get<{ message: PendingReceiptReversal[] }>(
          `/api/method/${RECEIPT_MODULE}.list_pending_reversals`
        )
      ).message,
  })
}

/** Only a School Head may call this -- see approve_receipt_reversal in the
 * backend's receipt.py. Approving submits the reversal in the same call. */
export function useApproveReceiptReversal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (reversalReceipt: string) => {
      const res = await api.post<{ message: string }>(
        `/api/method/${RECEIPT_MODULE}.approve_receipt_reversal`,
        { reversal_receipt: reversalReceipt }
      )
      return res.message
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt-reversals', 'pending'] })
    },
  })
}

export interface NewReceiptAllocation {
  fee_item: string
  amount: number
}

export interface NewReceiptInput {
  student: string
  invoice: string
  payment_method: string
  currency: 'ZiG' | 'USD'
  amount: number
  posting_date: string
  narration?: string
  external_reference?: string
  allocations?: NewReceiptAllocation[]
}

/** Create then submit in one call -- Receipt.on_submit is what actually
 * posts the journal entry and reduces the invoice's outstanding balance, so
 * an unsubmitted draft is not yet a real receipt. */
export function useCreateReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewReceiptInput) => {
      const created = await api.post<{ data: { name: string } }>(
        '/api/resource/Receipt',
        input
      )
      await api.post('/api/method/frappe.client.submit', {
        doc: JSON.stringify(created.data),
      })
      // integrity_hash is only assigned during the on_submit hook above, so
      // it isn't on `created.data` -- fetch it fresh so the receipt just
      // posted can produce a QR whose token actually verifies immediately,
      // instead of one carrying an empty/stale token.
      const submitted = await api.get<{ data: { integrity_hash?: string } }>(
        `/api/resource/Receipt/${encodeURIComponent(created.data.name)}`
      )
      return { name: created.data.name, integrityHash: submitted.data.integrity_hash }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

/** Drafts a reversal against an already-submitted Receipt -- stays
 * unsubmitted, not yet affecting any balance, until a School Head approves
 * it (out of scope here: that's the School Head shell, not Bursar). */
export function useRequestReceiptReversal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ receipt, reason }: { receipt: string; reason: string }) => {
      const res = await api.post<{ message: string }>(
        `/api/method/${RECEIPT_MODULE}.request_receipt_reversal`,
        { receipt, reversal_reason: reason }
      )
      return res.message
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt-reversals', 'pending'] })
    },
  })
}
