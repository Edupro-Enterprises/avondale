/** MoPSE ED46 Return doctype access -- see the backend repo's
 * edupro_school_fees/doctype/mopse_ed46_return/mopse_ed46_return.json.
 * generate_ed46_return snapshots School Name/EMIS/enrolment/revenue figures
 * onto the return at generation time -- all read-only fields here are
 * server-computed, never entered by hand. Three separate certify_as_*
 * whitelisted methods gate the three-way sign-off (Bursar/School
 * Head/SDC Chair) -- all three are now exposed, one per shell. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeEd46Return {
  name: string
  term: string
  school_name: string
  registration_number: string
  emis_number: string
  school_code: string
  physical_address: string
  district: string
  region: string
  total_enrolment: number
  levy_base_amount: number
  total_revenue_billed: number
  total_revenue_realized: number
  staffing_support_analysis?: string
  workflow_state: 'Draft' | 'Pending Certification' | 'Certified'
  bursar_certified: 0 | 1
  school_head_certified: 0 | 1
  sdc_certified: 0 | 1
  certified_on: string | null
}

const ED46_FIELDS = [
  'name', 'term', 'school_name', 'registration_number', 'emis_number', 'school_code', 'physical_address',
  'district', 'region', 'total_enrolment', 'levy_base_amount', 'total_revenue_billed', 'total_revenue_realized',
  'staffing_support_analysis', 'workflow_state', 'bursar_certified', 'school_head_certified', 'sdc_certified', 'certified_on',
]

export function useEd46Returns() {
  return useQuery({
    queryKey: ['ed46-returns'],
    queryFn: async () => {
      const res = await listResource<FrappeEd46Return>('MoPSE ED46 Return', {
        fields: JSON.stringify(ED46_FIELDS),
        order_by: 'modified desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

const ED46_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.mopse_ed46_return.mopse_ed46_return'

export function useGenerateEd46Return() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (term: string) => {
      const res = await api.post<{ message: string }>(`/api/method/${ED46_MODULE}.generate_ed46_return`, { term })
      return res.message
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ed46-returns'] }),
  })
}

export function useCertifyEd46ReturnAsBursar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.post(`/api/method/${ED46_MODULE}.certify_as_bursar`, { name })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ed46-returns'] }),
  })
}

export function useCertifyEd46ReturnAsSchoolHead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.post(`/api/method/${ED46_MODULE}.certify_as_school_head`, { name })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ed46-returns'] }),
  })
}

export function useCertifyEd46ReturnAsSdcChair() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.post(`/api/method/${ED46_MODULE}.certify_as_sdc_chair`, { name })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ed46-returns'] }),
  })
}

export function useUpdateEd46StaffingAnalysis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, text }: { name: string; text: string }) => {
      await api.put(`/api/resource/MoPSE ED46 Return/${encodeURIComponent(name)}`, { staffing_support_analysis: text })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ed46-returns'] }),
  })
}
