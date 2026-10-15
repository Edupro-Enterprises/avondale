/** Payment Plan doctype access -- see the backend repo's
 * edupro_school_fees/doctype/payment_plan/payment_plan.json and .py.
 * Installments must sum to exactly total_amount (server-enforced); status
 * auto-refreshes to Completed once every installment is Paid, and creating
 * a plan against an Open Debtor Case auto-moves that case to
 * "Payment Plan Active". */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappePaymentPlanInstallment {
  name: string
  due_date: string
  amount: number
  status: 'Pending' | 'Paid' | 'Overdue'
  paid_on?: string
}

export interface FrappePaymentPlan {
  name: string
  debtor_case: string
  student: string
  total_amount: number
  start_date: string
  status: 'Active' | 'Completed' | 'Defaulted' | 'Cancelled'
  installments: FrappePaymentPlanInstallment[]
}

const PAYMENT_PLAN_LIST_FIELDS = ['name', 'debtor_case', 'student', 'total_amount', 'start_date', 'status']

/** `installments` is a child table -- Frappe's list endpoint (get_list)
 * never returns child-table rows no matter what's in `fields`, they only
 * come back on a single-doc GET. Confirmed real crash: every plan in the
 * list came back with `installments: undefined`, and this page renders
 * every plan's installments inline (not one-at-a-time on selection, unlike
 * Requisition's quotations), so each plan's full doc is fetched in
 * parallel rather than lazily -- same fix shape as useRequisition, applied
 * per-row instead of per-selection. */
export function usePaymentPlans() {
  return useQuery({
    queryKey: ['payment-plans'],
    queryFn: async () => {
      const res = await listResource<FrappePaymentPlan>('Payment Plan', {
        fields: JSON.stringify(PAYMENT_PLAN_LIST_FIELDS),
        order_by: 'modified desc',
        limit_page_length: '0',
      })
      const withInstallments = await Promise.all(
        res.data.map(async (plan) => {
          try {
            const detail = await api.get<{ data: FrappePaymentPlan }>(`/api/resource/Payment Plan/${encodeURIComponent(plan.name)}`)
            return { ...plan, installments: detail.data.installments ?? [] }
          } catch {
            return { ...plan, installments: [] }
          }
        })
      )
      return withInstallments
    },
  })
}

export function useStudentPaymentPlan(studentId: string | undefined) {
  return useQuery({
    queryKey: ['payment-plans', 'student', studentId],
    queryFn: async () => {
      const res = await listResource<FrappePaymentPlan>('Payment Plan', {
        fields: JSON.stringify(PAYMENT_PLAN_LIST_FIELDS),
        filters: JSON.stringify([['student', '=', studentId]]),
        order_by: 'modified desc',
        limit_page_length: '1',
      })
      const plan = res.data[0]
      if (!plan) return null
      const detail = await api.get<{ data: FrappePaymentPlan }>(`/api/resource/Payment Plan/${encodeURIComponent(plan.name)}`)
      return { ...plan, installments: detail.data.installments ?? [] }
    },
    enabled: !!studentId,
  })
}

export interface NewInstallmentInput {
  due_date: string
  amount: number
}

export interface NewPaymentPlanInput {
  debtor_case: string
  total_amount: number
  start_date: string
  installments: NewInstallmentInput[]
}

export function useCreatePaymentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewPaymentPlanInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Payment Plan', input)
      return created.data.name
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] })
      queryClient.invalidateQueries({ queryKey: ['debtor-cases'] })
    },
  })
}

/** Replaces the whole installments table with one row marked Paid --
 * there's no dedicated whitelisted method for this, same pattern as
 * Requisition quotations. */
export function useMarkInstallmentPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ plan, installmentName, paidOn }: { plan: FrappePaymentPlan; installmentName: string; paidOn: string }) => {
      const installments = plan.installments.map((i) =>
        i.name === installmentName ? { due_date: i.due_date, amount: i.amount, status: 'Paid' as const, paid_on: paidOn } : { due_date: i.due_date, amount: i.amount, status: i.status, paid_on: i.paid_on }
      )
      await api.put(`/api/resource/Payment Plan/${encodeURIComponent(plan.name)}`, { installments })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-plans'] }),
  })
}
