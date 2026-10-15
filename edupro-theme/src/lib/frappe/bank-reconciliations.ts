/** Bank Reconciliation doctype access -- see the backend repo's
 * edupro_school_fees/doctype/bank_reconciliation/bank_reconciliation.json
 * and .py. balance_per_cashbook/reconciled_balance/variance are all
 * server-computed on save (summed straight from posted Journal Entry
 * Account rows against the chosen account/period) -- never user-entered,
 * unlike the earlier mock's free-typed "book balance" field. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeBankReconciliation {
  name: string
  bank_account: string
  period_end: string
  balance_per_statement: number
  balance_per_cashbook: number
  reconciled_balance: number
  variance: number
  workflow_state: 'Draft' | 'Pending Head Sign-Off' | 'Reconciled' | 'Discrepancy Flagged'
}

const BANK_RECON_FIELDS = [
  'name', 'bank_account', 'period_end', 'balance_per_statement', 'balance_per_cashbook',
  'reconciled_balance', 'variance', 'workflow_state',
]

export function useBankReconciliations() {
  return useQuery({
    queryKey: ['bank-reconciliations'],
    queryFn: async () => {
      const res = await listResource<FrappeBankReconciliation>('Bank Reconciliation', {
        fields: JSON.stringify(BANK_RECON_FIELDS),
        order_by: 'period_end desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeReconciliationAdjustment {
  name: string
  adjustment_type: 'Deposit in Transit' | 'Unpresented Cheque' | 'Bank Charge' | 'Other Adjustment'
  description: string
  amount: number
}

export interface FrappeBankReconciliationDetail extends FrappeBankReconciliation {
  adjustments: FrappeReconciliationAdjustment[]
}

export function useBankReconciliation(name: string | undefined) {
  return useQuery({
    queryKey: ['bank-reconciliation', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeBankReconciliationDetail }>(
          `/api/resource/Bank Reconciliation/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}

export interface NewAdjustmentInput {
  adjustment_type: FrappeReconciliationAdjustment['adjustment_type']
  description: string
  amount: number
}

export interface NewBankReconciliationInput {
  bank_account: string
  period_end: string
  balance_per_statement: number
  adjustments: NewAdjustmentInput[]
}

export function useCreateBankReconciliation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBankReconciliationInput) => {
      const created = await api.post<{ data: FrappeBankReconciliationDetail }>('/api/resource/Bank Reconciliation', input)
      return created.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'] }),
  })
}

export function useSetBankReconciliationState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, workflow_state }: { name: string; workflow_state: FrappeBankReconciliation['workflow_state'] }) => {
      await api.put(`/api/resource/Bank Reconciliation/${encodeURIComponent(name)}`, { workflow_state })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation', variables.name] })
    },
  })
}
