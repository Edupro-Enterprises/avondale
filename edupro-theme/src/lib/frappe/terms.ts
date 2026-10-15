/** Term doctype access -- see the backend repo's
 * edupro_school_fees/doctype/term/term.json and .py. Terms are
 * auto-created 3-at-a-time when their Academic Year is created (see
 * academic-years.ts) -- there is no create action here, only editing
 * dates and marking one current (which clears every other Term). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeTerm {
  name: string
  term_name: string
  academic_year: string
  term_number: number
  term_type: 'Term1' | 'Term2' | 'Term3'
  start_date: string
  end_date: string
  is_active: 0 | 1
  is_current: 0 | 1
}

export function useTerms() {
  return useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await listResource<FrappeTerm>('Term', {
        fields: JSON.stringify(['name', 'term_name', 'academic_year', 'term_number', 'term_type', 'start_date', 'end_date', 'is_active', 'is_current']),
        order_by: 'start_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useUpdateTerm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, input }: { name: string; input: Partial<Pick<FrappeTerm, 'start_date' | 'end_date' | 'is_active'>> }) => {
      await api.put(`/api/resource/Term/${encodeURIComponent(name)}`, input)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terms'] }),
  })
}

export function useSetTermCurrent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.put(`/api/resource/Term/${encodeURIComponent(name)}`, { is_current: 1 })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terms'] }),
  })
}
