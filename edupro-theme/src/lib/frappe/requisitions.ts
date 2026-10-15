/** Requisition doctype access -- see the backend repo's
 * edupro_school_fees/doctype/requisition/requisition.json and .py. Real
 * status is only Open/Closed (Closed happens automatically the instant a
 * Purchase Order is issued against it -- see purchase-orders.ts) -- the
 * earlier mock's Draft/Pending Quotes/Approved/Converted to PO/Rejected
 * set doesn't exist on this doctype; there is no separate approval step
 * for a Requisition itself. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import type { Fund } from './journal-entries'

export interface FrappeRequisition {
  name: string
  requested_by: string
  fund: Fund
  budget_line: string
  purpose: string
  posting_date: string
  total_estimated_amount: number
  status: 'Open' | 'Closed'
}

const REQUISITION_FIELDS = ['name', 'requested_by', 'fund', 'budget_line', 'purpose', 'posting_date', 'total_estimated_amount', 'status']

export function useRequisitions() {
  return useQuery({
    queryKey: ['requisitions'],
    queryFn: async () => {
      const res = await listResource<FrappeRequisition>('Requisition', {
        fields: JSON.stringify(REQUISITION_FIELDS),
        order_by: 'posting_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeRequisitionItem {
  name: string
  description: string
  quantity: number
  unit?: string
  estimated_unit_cost: number
  estimated_amount: number
}

export interface FrappeQuotationItem {
  name: string
  vendor: string
  vendor_name: string
  quoted_amount: number
  currency: 'ZiG' | 'USD'
  quotation_document: string
  is_selected: 0 | 1
}

export interface FrappeRequisitionDetail extends FrappeRequisition {
  items: FrappeRequisitionItem[]
  quotations: FrappeQuotationItem[]
}

export function useRequisition(name: string | undefined) {
  return useQuery({
    queryKey: ['requisition', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeRequisitionDetail }>(`/api/resource/Requisition/${encodeURIComponent(name!)}`)
      ).data,
    enabled: !!name,
  })
}

export interface NewRequisitionItemInput {
  description: string
  quantity: number
  estimated_unit_cost: number
}

export interface NewRequisitionInput {
  fund: Fund
  budget_line: string
  purpose: string
  posting_date: string
  items: NewRequisitionItemInput[]
}

export function useCreateRequisition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRequisitionInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Requisition', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requisitions'] }),
  })
}

export interface QuotationItemInput {
  vendor: string
  quoted_amount: number
  currency: 'ZiG' | 'USD'
  quotation_document: string
  is_selected?: 0 | 1
}

/** Replaces the whole quotations table -- the simplest way to add/edit/
 * select rows from a frontend that isn't Desk's row-editable grid.
 * Callers must pass the full desired set (existing rows + the change),
 * not just the delta. */
export function useSaveRequisitionQuotations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, quotations }: { name: string; quotations: QuotationItemInput[] }) => {
      const res = await api.put<{ data: FrappeRequisitionDetail }>(`/api/resource/Requisition/${encodeURIComponent(name)}`, { quotations })
      return res.data
    },
    // Write the server's response straight into the cache instead of just
    // invalidating -- invalidateQueries kicks off a refetch but doesn't wait
    // for it, so a caller awaiting mutateAsync (e.g. addQuotation, adding a
    // second quotation right after the first) could still read the stale
    // `quotations` array from the old cached requisition and overwrite the
    // just-saved row. setQueryData is synchronous, so there's no window.
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['requisition', variables.name], data)
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
    },
  })
}

/** Read-only lookup so the UI can show "you need N quotations for this
 * amount" live while a Requisition is still being assembled. */
export async function getRequiredQuoteCount(amount: number): Promise<number> {
  const res = await api.post<{ message: number }>(
    '/api/method/edupro_school_fees.edupro_school_fees.doctype.purchase_order.purchase_order.get_required_quote_count_for_amount',
    { amount }
  )
  return res.message
}
