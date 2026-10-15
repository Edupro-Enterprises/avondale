/** Class Stream doctype access -- see the backend repo's
 * edupro_school_fees/doctype/class_stream/class_stream.json. Newly added
 * to the backend -- deliberately not linked from Student (Student.grade
 * stays the free-text field it already is, to avoid migrating an
 * already-populated production column). Current enrolment is computed
 * here by matching Student.grade against stream_name by string equality,
 * the same rollup pattern already used elsewhere in this app. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeClassStream {
  name: string
  stream_name: string
  grade_group: string
  capacity?: number
}

export function useClassStreams() {
  return useQuery({
    queryKey: ['class-streams'],
    queryFn: async () => {
      const res = await listResource<FrappeClassStream>('Class Stream', {
        fields: JSON.stringify(['name', 'stream_name', 'grade_group', 'capacity']),
        order_by: 'stream_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewClassStreamInput {
  stream_name: string
  grade_group: string
  capacity?: number
}

export function useCreateClassStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewClassStreamInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Class Stream', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['class-streams'] }),
  })
}
