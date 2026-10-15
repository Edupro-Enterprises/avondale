/** Academic Year doctype access -- see the backend repo's
 * edupro_school_fees/doctype/academic_year/academic_year.json and .py.
 * Creating one auto-generates its 3 Terms server-side (after_insert()) --
 * there's no separate "add term" flow, see terms.ts. Setting is_current
 * automatically clears it on every other Academic Year. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeAcademicYear {
  name: string
  academic_year_name: string
  start_date: string
  end_date: string
  is_active: 0 | 1
  is_current: 0 | 1
}

export function useAcademicYears() {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await listResource<FrappeAcademicYear>('Academic Year', {
        fields: JSON.stringify(['name', 'academic_year_name', 'start_date', 'end_date', 'is_active', 'is_current']),
        order_by: 'start_date desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewAcademicYearInput {
  academic_year_name: string
  start_date: string
  end_date: string
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewAcademicYearInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Academic Year', input)
      return created.data.name
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] })
      queryClient.invalidateQueries({ queryKey: ['terms'] })
    },
  })
}

export function useSetAcademicYearCurrent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.put(`/api/resource/Academic Year/${encodeURIComponent(name)}`, { is_current: 1 })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })
}
