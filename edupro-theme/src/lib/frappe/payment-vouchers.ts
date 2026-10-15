/** Payment Voucher doctype access -- see the backend repo's
 * edupro_school_fees/doctype/payment_voucher/payment_voucher.json and .py.
 * A Bursar can create (Draft) and submit one for approval. SDC Co-Approval
 * and School Head final approval are both just workflow_state PUTs on this
 * same doctype (useDecidePaymentVoucher below) -- the backend's validate()
 * enforces the same-actor and sensitive-procurement gates regardless of who
 * calls it. The backend auto-routes a Fund A voucher straight to "Pending
 * School Head Approval" regardless of what's requested (see
 * payment_voucher.py's validate()), since SDC has no access to Fund A at all. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import type { Fund } from './journal-entries'

export interface FrappePaymentVoucher {
  name: string
  purchase_order: string
  fund: Fund
  budget_line: string
  amount: number
  currency: 'ZiG' | 'USD'
  payment_method: string
  workflow_state: 'Draft' | 'Pending SDC Co-Approval' | 'Pending School Head Approval' | 'Approved' | 'Rejected'
  disbursed: 0 | 1
  is_sensitive_procurement: 0 | 1
  sensitive_co_signed_by?: string
}

const PV_FIELDS = [
  'name', 'purchase_order', 'fund', 'budget_line', 'amount', 'currency', 'payment_method',
  'workflow_state', 'disbursed', 'is_sensitive_procurement', 'sensitive_co_signed_by',
]

export function usePaymentVouchers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['payment-vouchers'],
    enabled: options?.enabled,
    queryFn: async () => {
      const res = await listResource<FrappePaymentVoucher>('Payment Voucher', {
        fields: JSON.stringify(PV_FIELDS),
        order_by: 'modified desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useCreatePaymentVoucher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ purchaseOrder, paymentMethod }: { purchaseOrder: string; paymentMethod: string }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Payment Voucher', {
        purchase_order: purchaseOrder,
        payment_method: paymentMethod,
      })
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] }),
  })
}

/** Submits a Draft voucher into the approval chain -- always requests
 * "Pending SDC Co-Approval"; the server itself redirects a Fund A voucher
 * straight to "Pending School Head Approval". */
export function useSubmitPaymentVoucherForApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.put(`/api/resource/Payment Voucher/${encodeURIComponent(name)}`, {
        workflow_state: 'Pending SDC Co-Approval',
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] }),
  })
}

/** Shared by SDC (co-approve/reject at "Pending SDC Co-Approval") and School
 * Head (final approve/reject at "Pending School Head Approval") -- both are
 * just workflow_state transitions on this one doctype; the backend's own
 * validate() enforces who's allowed to make each transition and the
 * same-actor/sensitive-procurement gates. */
export function useDecidePaymentVoucher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, workflow_state }: { name: string; workflow_state: 'Pending School Head Approval' | 'Approved' | 'Rejected' }) => {
      await api.put(`/api/resource/Payment Voucher/${encodeURIComponent(name)}`, { workflow_state })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] }),
  })
}
