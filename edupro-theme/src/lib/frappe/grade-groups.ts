/** Grade Group doctype access -- see the backend repo's
 * edupro_school_fees/doctype/grade_group/grade_group.json. A flat
 * reference entity (no workflow), newly added to the backend -- see
 * class-streams.ts for why Student.grade stays unlinked. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeGradeGroup {
  name: string
  grade_group_name: string
  description?: string
}

export function useGradeGroups() {
  return useQuery({
    queryKey: ['grade-groups'],
    queryFn: async () => {
      const res = await listResource<FrappeGradeGroup>('Grade Group', {
        fields: JSON.stringify(['name', 'grade_group_name', 'description']),
        order_by: 'grade_group_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useCreateGradeGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { grade_group_name: string; description?: string }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Grade Group', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grade-groups'] }),
  })
}
