/** Communication Log doctype access -- see the backend repo's
 * edupro_school_fees/doctype/communication_log/communication_log.json.
 * Bursar can create but not edit (write:0) -- an append-only contact log,
 * matching how Receipts can't be edited once posted. There is no
 * Communication Template doctype on the backend -- the earlier mock's
 * template picker has nothing to wire to. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeCommunicationLog {
  name: string
  debtor_case?: string
  parent_guardian?: string
  student?: string
  channel: 'Phone' | 'SMS' | 'Email' | 'WhatsApp' | 'In-Person' | 'Letter'
  direction: 'Outbound' | 'Inbound'
  summary: string
  logged_by: string
  logged_on: string
}

export function useCommunications() {
  return useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const res = await listResource<FrappeCommunicationLog>('Communication Log', {
        fields: JSON.stringify(['name', 'debtor_case', 'parent_guardian', 'student', 'channel', 'direction', 'summary', 'logged_by', 'logged_on']),
        order_by: 'logged_on desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewCommunicationInput {
  debtor_case?: string
  parent_guardian?: string
  student?: string
  channel: FrappeCommunicationLog['channel']
  summary: string
}

export function useLogCommunication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewCommunicationInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Communication Log', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications'] }),
  })
}
