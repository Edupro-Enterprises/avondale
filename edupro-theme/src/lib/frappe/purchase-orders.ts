/** Purchase Order doctype access -- see the backend repo's
 * edupro_school_fees/doctype/purchase_order/purchase_order.json and .py.
 * Creation IS issuance -- there's no separate draft-then-issue step;
 * after_insert() immediately closes the Requisition and commits the
 * Budget Line. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import type { Fund } from './journal-entries'

export interface FrappePurchaseOrder {
  name: string
  requisition: string
  fund: Fund
  budget_line: string
  vendor_name: string
  amount: number
  currency: 'ZiG' | 'USD'
  posting_date: string
  status: 'Draft' | 'Issued' | 'Cancelled'
  is_sensitive_procurement: 0 | 1
}

const PO_FIELDS = ['name', 'requisition', 'fund', 'budget_line', 'vendor_name', 'amount', 'currency', 'posting_date', 'status', 'is_sensitive_procurement']

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await listResource<FrappePurchaseOrder>('Purchase Order', {
        fields: JSON.stringify(PO_FIELDS),
        order_by: 'posting_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useIssuePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ requisition, postingDate }: { requisition: string; postingDate: string }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Purchase Order', {
        requisition,
        posting_date: postingDate,
      })
      return created.data.name
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      queryClient.invalidateQueries({ queryKey: ['requisition'] })
    },
  })
}
