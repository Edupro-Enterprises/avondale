/** Petty Cash doctypes -- see the backend repo's
 * edupro_school_fees/doctype/petty_cash_{float,voucher,replenishment}/*.json
 * and their .py hooks. Three real entities, not the single free-form ledger
 * the earlier mock modeled:
 *  - Petty Cash Float: a named imprest balance with a ceiling.
 *  - Petty Cash Voucher: an expense against a float (Pending Reimbursement
 *    -> Reimbursed), classified to a Budget Line. No currency field --
 *    always the float's own account currency.
 *  - Petty Cash Replenishment: tops a float back up by exactly the sum of
 *    its Pending Reimbursement vouchers -- amount is server-computed, never
 *    typed in.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappePettyCashFloat {
  name: string
  custodian: string
  account: string
  float_amount: number
  balance: number
  status: 'Active' | 'Closed'
}

export function usePettyCashFloats() {
  return useQuery({
    queryKey: ['petty-cash-floats'],
    queryFn: async () => {
      const res = await listResource<FrappePettyCashFloat>('Petty Cash Float', {
        fields: JSON.stringify(['name', 'custodian', 'account', 'float_amount', 'balance', 'status']),
        order_by: 'float_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useCreatePettyCashFloat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { float_name: string; custodian: string; account: string; float_amount: number }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Petty Cash Float', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['petty-cash-floats'] }),
  })
}

export interface FrappePettyCashVoucher {
  name: string
  petty_cash_float: string
  posting_date: string
  description: string
  amount: number
  budget_line: string
  receipt_attachment?: string
  status: 'Pending Reimbursement' | 'Reimbursed'
}

const VOUCHER_FIELDS = ['name', 'petty_cash_float', 'posting_date', 'description', 'amount', 'budget_line', 'receipt_attachment', 'status']

export function usePettyCashVouchers(floatName: string | undefined) {
  return useQuery({
    queryKey: ['petty-cash-vouchers', floatName],
    queryFn: async () => {
      const res = await listResource<FrappePettyCashVoucher>('Petty Cash Voucher', {
        fields: JSON.stringify(VOUCHER_FIELDS),
        filters: JSON.stringify([
          ['petty_cash_float', '=', floatName],
          ['docstatus', '=', 1],
        ]),
        order_by: 'posting_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
    enabled: !!floatName,
  })
}

export interface NewPettyCashVoucherInput {
  petty_cash_float: string
  posting_date: string
  description: string
  amount: number
  budget_line: string
  receipt_attachment?: string
}

export function useCreatePettyCashVoucher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewPettyCashVoucherInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Petty Cash Voucher', input)
      await api.post('/api/method/frappe.client.submit', { doc: JSON.stringify(created.data) })
      return created.data.name
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-vouchers', variables.petty_cash_float] })
      queryClient.invalidateQueries({ queryKey: ['petty-cash-floats'] })
    },
  })
}

/** amount is deliberately not accepted here -- the backend always
 * recomputes it as the sum of the float's own Pending Reimbursement
 * vouchers (see PettyCashReplenishment.validate()). */
export interface NewPettyCashReplenishmentInput {
  petty_cash_float: string
  posting_date: string
  payment_method: string
}

export function useCreatePettyCashReplenishment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewPettyCashReplenishmentInput) => {
      const created = await api.post<{ data: { name: string; amount: number } }>(
        '/api/resource/Petty Cash Replenishment',
        input
      )
      await api.post('/api/method/frappe.client.submit', { doc: JSON.stringify(created.data) })
      return created.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-vouchers', variables.petty_cash_float] })
      queryClient.invalidateQueries({ queryKey: ['petty-cash-floats'] })
    },
  })
}
