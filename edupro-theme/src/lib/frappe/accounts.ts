/** Account (Chart of Accounts) doctype access -- see the backend repo's
 * edupro_school_fees/doctype/account/account.json. Bursar has read-only
 * access (write:0, create:0 -- System Manager owns the Chart of Accounts),
 * so this file has no mutations. */
import { useQuery } from '@tanstack/react-query'
import { listResource } from './client'
import type { Fund } from './journal-entries'

export interface FrappeAccount {
  name: string
  account_type: 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity'
  fund?: Fund
  currency: 'ZiG' | 'USD'
  is_group: 0 | 1
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await listResource<FrappeAccount>('Account', {
        fields: JSON.stringify(['name', 'account_type', 'fund', 'currency', 'is_group']),
        filters: JSON.stringify([['is_group', '=', 0]]),
        order_by: 'name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}
