/** Cost Center doctype access -- see the backend repo's
 * edupro_school_fees/doctype/cost_center/cost_center.json. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeCostCenter {
  name: string
  parent_cost_center?: string
  is_group: 0 | 1
  description?: string
  is_disabled: 0 | 1
}

export function useCostCenters() {
  return useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const res = await listResource<FrappeCostCenter>('Cost Center', {
        fields: JSON.stringify(['name', 'parent_cost_center', 'is_group', 'description', 'is_disabled']),
        order_by: 'name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useCreateCostCenter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cost_center_name: string; description?: string; parent_cost_center?: string }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Cost Center', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cost-centers'] }),
  })
}
