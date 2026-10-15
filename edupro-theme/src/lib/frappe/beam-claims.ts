/** BEAM Claim doctype access -- see the backend repo's
 * edupro_school_fees/doctype/beam_claim/beam_claim.json. Reconciliation
 * (unpaid_claim/cumulative_unpaid_claim) is computed server-side by the
 * whitelisted get_beam_reconciliation method, mirroring the old web/
 * frontend's lib/staff.ts exactly, rather than derived client-side from
 * a student's mock coverage percentage. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export interface BeamReconciliationRow {
  name: string
  student: string
  student_name: string
  grade: string | null
  term: string
  claim_date: string
  tuition_arrears_claimed: number
  sdc_levy_arrears_claimed: number
  treasury_amount_disbursed: number
  unpaid_claim: number
  cumulative_unpaid_claim: number
}

export interface BeamReconciliation {
  rows: BeamReconciliationRow[]
  totals: {
    total_tuition_claimed: number
    total_sdc_levy_claimed: number
    total_disbursed: number
    total_unpaid: number
  }
}

const BEAM_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.beam_claim.beam_claim'

export function useBeamReconciliation(term?: string) {
  return useQuery({
    queryKey: ['beam-reconciliation', term],
    queryFn: async () => {
      const qs = term ? `?term=${encodeURIComponent(term)}` : ''
      return (await api.get<{ message: BeamReconciliation }>(`/api/method/${BEAM_MODULE}.get_beam_reconciliation${qs}`)).message
    },
  })
}

export interface NewBeamClaimInput {
  student: string
  term: string
  claim_date: string
  tuition_arrears_claimed: number
  sdc_levy_arrears_claimed: number
}

export function useCreateBeamClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBeamClaimInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/BEAM Claim', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beam-reconciliation'] }),
  })
}

export function useRecordBeamDisbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, amount, reference }: { name: string; amount: number; reference?: string }) => {
      await api.put(`/api/resource/BEAM Claim/${encodeURIComponent(name)}`, {
        treasury_amount_disbursed: amount,
        ...(reference ? { disbursement_reference: reference } : {}),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beam-reconciliation'] }),
  })
}
