/** Fee Structure doctype access -- see the backend repo's
 * edupro_school_fees/doctype/fee_structure/fee_structure.json. */
import { useQuery } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeFeeStructure {
  name: string
  structure_name: string
  academic_year: string
  term: string
  total_amount: number
  workflow_state: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected'
  beneficiary_category?: string
}

export interface FrappeFeeStructureItem {
  fee_item: string
  currency: 'ZiG' | 'USD'
  amount: number
  account?: string
  beneficiary_category?: string
}

export interface FrappeFeeStructureDetail extends FrappeFeeStructure {
  items: FrappeFeeStructureItem[]
  owner: string
  school_head_co_signed_by?: string
  school_head_co_signed_on?: string
  sdc_co_signed_by?: string
  sdc_co_signed_on?: string
  approved_by?: string
  approved_on?: string
  revision_of?: string
  superseded_by?: string
}

const FEE_STRUCTURE_LIST_FIELDS = [
  'name',
  'structure_name',
  'academic_year',
  'term',
  'total_amount',
  'workflow_state',
  'beneficiary_category',
]

export function useFeeStructures() {
  return useQuery({
    queryKey: ['fee-structures'],
    queryFn: async () => {
      const res = await listResource<FrappeFeeStructure>('Fee Structure', {
        fields: JSON.stringify(FEE_STRUCTURE_LIST_FIELDS),
        order_by: 'modified desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useFeeStructure(name: string | undefined) {
  return useQuery({
    queryKey: ['fee-structure', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeFeeStructureDetail }>(
          `/api/resource/Fee Structure/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}
