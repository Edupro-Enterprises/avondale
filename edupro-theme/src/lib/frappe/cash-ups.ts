/** Cash Up doctype access -- see the backend repo's
 * edupro_school_fees/edupro_school_fees/doctype/cash_up/cash_up.json. A
 * cash-up is one action from the cashier's side (count the drawer, submit)
 * -- create-then-submit happens inside submit_cash_up itself, mirroring the
 * old web/ frontend's lib/staff.ts submitCashUp exactly. There is no
 * cashier/supervisor/head confirmation field on this doctype -- the mock
 * UI's triple-checkbox gate didn't correspond to anything the backend
 * tracks, so it's dropped rather than ported. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import type { FrappeReceipt } from './receipts'

export interface FrappeCashUp {
  name: string
  cashier: string
  cash_up_date: string
  workflow_state: 'Draft' | 'Balanced' | 'Variance Flagged' | 'Resolved'
  notes?: string
  reviewed_by?: string
}

export function useCashUps() {
  return useQuery({
    queryKey: ['cash-ups'],
    queryFn: async () => {
      const res = await listResource<FrappeCashUp>('Cash Up', {
        fields: JSON.stringify(['name', 'cashier', 'cash_up_date', 'workflow_state', 'notes', 'reviewed_by']),
        order_by: 'cash_up_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeCashUpLine {
  name: string
  payment_method: string
  system_amount: number
  counted_amount: number
  variance: number
}

export interface FrappeCashUpDetail extends FrappeCashUp {
  lines: FrappeCashUpLine[]
  handover_to?: string
  cash_handed_over?: number
  reviewed_on?: string
}

export function useCashUp(name: string | undefined) {
  return useQuery({
    queryKey: ['cash-up', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeCashUpDetail }>(`/api/resource/Cash Up/${encodeURIComponent(name!)}`)
      ).data,
    enabled: !!name,
  })
}

/** Client-side preview of what submit_cash_up will compute as system_amount
 * per payment method -- this cashier's own submitted Receipts for the given
 * date, matching Cash Up Line's own description. The server recomputes this
 * authoritatively on submit; this is only shown before then so the cashier
 * knows what to count against. */
export function useTodayReceiptTotals(cashier: string | undefined, date: string) {
  return useQuery({
    queryKey: ['receipts', 'cash-up-preview', cashier, date],
    queryFn: async () => {
      const res = await listResource<FrappeReceipt>('Receipt', {
        fields: JSON.stringify(['payment_method', 'amount']),
        filters: JSON.stringify([
          ['received_by', '=', cashier],
          ['posting_date', '=', date],
          ['docstatus', '=', 1],
        ]),
        limit_page_length: '0',
      })
      const totals = new Map<string, number>()
      for (const r of res.data) totals.set(r.payment_method, (totals.get(r.payment_method) ?? 0) + r.amount)
      return totals
    },
    enabled: !!cashier,
  })
}

const CASH_UP_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.cash_up.cash_up'

export interface CashUpResult {
  name: string
  cashier: string
  cash_up_date: string
  workflow_state: FrappeCashUp['workflow_state']
  notes?: string
  lines: Array<{ payment_method: string; system_amount: number; counted_amount: number; variance: number }>
}

/** FR-CSH-04: a cashier whose most recent Cash Up is "Variance Flagged"
 * cannot record new receipts until a School Head resolves it (see
 * resolve_cash_up in the backend's cash_up.py, School-Head-only). Confirmed
 * real gap: no UI anywhere called this, so a flagged cash-up had no
 * recovery path and silently blocked a Bursar's receipting indefinitely. */
export function useResolveCashUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, notes }: { name: string; notes?: string }) => {
      const res = await api.post<{ message: CashUpResult }>(`/api/method/${CASH_UP_MODULE}.resolve_cash_up`, {
        name,
        notes: notes || undefined,
      })
      return res.message
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cash-ups'] }),
  })
}

export function useSubmitCashUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cashUpDate,
      lines,
      handoverTo,
      cashHandedOver,
      notes,
    }: {
      cashUpDate: string
      lines: Array<{ payment_method: string; counted_amount: number }>
      handoverTo?: string
      cashHandedOver?: number
      notes?: string
    }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Cash Up', {
        cash_up_date: cashUpDate,
        lines,
        handover_to: handoverTo || undefined,
        cash_handed_over: cashHandedOver || undefined,
        notes: notes || undefined,
      })
      const res = await api.post<{ message: CashUpResult }>(`/api/method/${CASH_UP_MODULE}.submit_cash_up`, {
        name: created.data.name,
      })
      return res.message
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cash-ups'] }),
  })
}
