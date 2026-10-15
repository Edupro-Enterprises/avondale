/** Asset (Fixed Assets Register) doctype access -- see the backend repo's
 * edupro_school_fees/doctype/asset/asset.json and .py. accumulated_depreciation
 * and net_book_value are server-computed -- accumulated_depreciation only by
 * a scheduled nightly job (edupro_school_fees.utils.run_asset_depreciation),
 * never by the frontend, so there's no client-computable "depreciation
 * schedule" to project forward the way the earlier mock did; this only
 * shows the running total actually posted so far. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeAsset {
  name: string
  asset_code: string
  description: string
  purchase_order?: string
  praz_reference?: string
  date_acquired: string
  historical_cost: number
  currency: 'ZiG' | 'USD'
  depreciation_method: 'Straight Line'
  depreciation_rate: number
  depreciation_expense_account: string
  accumulated_depreciation_account: string
  accumulated_depreciation: number
  net_book_value: number
  physical_location?: string
  condition: 'Good' | 'Fair' | 'Poor'
  disposal_status: 'In Use' | 'Disposed'
  disposal_date?: string
  disposal_praz_reference?: string
}

const ASSET_FIELDS = [
  'name', 'asset_code', 'description', 'purchase_order', 'praz_reference', 'date_acquired',
  'historical_cost', 'currency', 'depreciation_method', 'depreciation_rate',
  'depreciation_expense_account', 'accumulated_depreciation_account', 'accumulated_depreciation',
  'net_book_value', 'physical_location', 'condition', 'disposal_status', 'disposal_date', 'disposal_praz_reference',
]

export function useFixedAssets(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['fixed-assets'],
    enabled: options?.enabled,
    queryFn: async () => {
      const res = await listResource<FrappeAsset>('Asset', {
        fields: JSON.stringify(ASSET_FIELDS),
        order_by: 'date_acquired desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewAssetInput {
  asset_code: string
  description: string
  date_acquired: string
  historical_cost: number
  currency: 'ZiG' | 'USD'
  depreciation_rate: number
  depreciation_expense_account: string
  accumulated_depreciation_account: string
  physical_location?: string
  praz_reference?: string
  purchase_order?: string
}

export function useCreateFixedAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewAssetInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Asset', {
        ...input,
        depreciation_method: 'Straight Line',
      })
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }),
  })
}

export function useDisposeAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, disposalDate, prazReference }: { name: string; disposalDate: string; prazReference?: string }) => {
      await api.put(`/api/resource/Asset/${encodeURIComponent(name)}`, {
        disposal_status: 'Disposed',
        disposal_date: disposalDate,
        disposal_praz_reference: prazReference || undefined,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }),
  })
}
