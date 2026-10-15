/** Communication Template doctype access -- see the backend repo's
 * edupro_school_fees/doctype/communication_template/communication_template.json. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export type TemplateChannel = 'SMS' | 'Email' | 'Phone' | 'In-Person'

export interface FrappeCommunicationTemplate {
  name: string
  template_name: string
  channel: TemplateChannel
  subject?: string
  body: string
}

const TEMPLATE_FIELDS = ['name', 'template_name', 'channel', 'subject', 'body']

export function useCommunicationTemplates() {
  return useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const res = await listResource<FrappeCommunicationTemplate>('Communication Template', {
        fields: JSON.stringify(TEMPLATE_FIELDS),
        order_by: 'template_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewCommunicationTemplateInput {
  template_name: string
  channel: TemplateChannel
  subject?: string
  body: string
}

export function useCreateCommunicationTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewCommunicationTemplateInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Communication Template', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communication-templates'] }),
  })
}

export function useDeleteCommunicationTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.delete(`/api/resource/Communication Template/${encodeURIComponent(name)}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communication-templates'] }),
  })
}

/** Substitutes a template's placeholders with a specific case's real data --
 * only {studentName}/{amount}/{ageingBucket} are ever backed by a real field
 * (a case has no single "due date" of its own, so that placeholder from the
 * old mock was dropped rather than filled with a fabricated value). */
export function renderTemplate(
  template: Pick<FrappeCommunicationTemplate, 'subject' | 'body'>,
  data: { studentName: string; amount: string; ageingBucket: string }
) {
  const fill = (text: string) =>
    text
      .split('{studentName}').join(data.studentName)
      .split('{amount}').join(data.amount)
      .split('{ageingBucket}').join(data.ageingBucket)
  return { subject: template.subject ? fill(template.subject) : '', body: fill(template.body) }
}
