/** Applicant doctype access -- see the backend repo's
 * edupro_school_fees/doctype/applicant/applicant.json and .py. Real status
 * is only Under Review/Waitlisted/Accepted/Declined -- "Enrolled" isn't a
 * status value at all, it's derived from enrolled_student being set (the
 * Applicant stays Accepted after enrolment). enrol_applicant is the actual
 * admissions-to-registry handoff: creates a real Parent Guardian and
 * Student in one call, Bursar-only. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource, uploadFile } from './client'

export interface FrappeApplicant {
  name: string
  full_legal_name: string
  date_of_birth: string
  gender?: 'Female' | 'Male'
  academic_year: string
  intended_term?: string
  entry_grade?: string
  attendance_type: 'Day Scholar' | 'Boarder'
  beneficiary_category?: string
  status: 'Under Review' | 'Waitlisted' | 'Accepted' | 'Declined'
  guardian_name: string
  guardian_phone: string
  enrolled_student?: string
}

const APPLICANT_LIST_FIELDS = [
  'name', 'full_legal_name', 'date_of_birth', 'gender', 'academic_year', 'intended_term',
  'entry_grade', 'attendance_type', 'beneficiary_category', 'status', 'guardian_name', 'guardian_phone', 'enrolled_student',
]

export function useApplicants() {
  return useQuery({
    queryKey: ['applicants'],
    queryFn: async () => {
      const res = await listResource<FrappeApplicant>('Applicant', {
        fields: JSON.stringify(APPLICANT_LIST_FIELDS),
        order_by: 'modified desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeApplicantDocument {
  name: string
  document_type: string
  attachment: string
}

export interface FrappeApplicantDetail extends FrappeApplicant {
  home_address?: string
  previous_school_name?: string
  previous_school_emis_number?: string
  last_grade_completed?: string
  national_exam_type?: string
  national_exam_results?: string
  application_fee_receipt_number?: string
  application_fee_amount?: number
  application_fee_currency?: 'ZiG' | 'USD'
  application_fee_payment_method?: string
  application_fee_journal_entry?: string
  guardian_relationship?: 'Mother' | 'Father' | 'Guardian' | 'Other'
  guardian_email?: string
  documents: FrappeApplicantDocument[]
  decision_notes?: string
  offer_accepted_on?: string
  enrolled_on?: string
}

export function useApplicant(name: string | undefined) {
  return useQuery({
    queryKey: ['applicant', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeApplicantDetail }>(`/api/resource/Applicant/${encodeURIComponent(name!)}`)
      ).data,
    enabled: !!name,
  })
}

export interface NewApplicantInput {
  full_legal_name: string
  date_of_birth: string
  gender?: 'Female' | 'Male'
  academic_year: string
  intended_term?: string
  entry_grade?: string
  attendance_type: 'Day Scholar' | 'Boarder'
  guardian_name: string
  guardian_phone: string
  guardian_relationship?: string
  guardian_email?: string
}

export function useCreateApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewApplicantInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Applicant', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applicants'] }),
  })
}

export interface NewApplicationInput {
  full_legal_name: string
  date_of_birth: string
  gender?: 'Female' | 'Male'
  entry_grade?: string
  attendance_type: 'Day Scholar' | 'Boarder'
  guardian_name: string
  guardian_phone: string
  guardian_relationship?: string
  guardian_email?: string
}

/** Public, no-login submission -- see submit_application() in the backend's
 * applicant.py. Distinct from useCreateApplicant (Bursar-only, hits the raw
 * Applicant resource endpoint): this hits a narrow guest-accessible
 * whitelisted method instead, which is the only thing a public form is
 * allowed to call. */
export function useSubmitApplication() {
  return useMutation({
    mutationFn: async (input: NewApplicationInput) => {
      const res = await api.post<{ message: string }>(
        `/api/method/${APPLICANT_MODULE}.submit_application`,
        input
      )
      return res.message
    },
  })
}

function invalidateApplicant(queryClient: ReturnType<typeof useQueryClient>, name: string) {
  queryClient.invalidateQueries({ queryKey: ['applicants'] })
  queryClient.invalidateQueries({ queryKey: ['applicant', name] })
}

export function useUpdateApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, input }: { name: string; input: Partial<Omit<FrappeApplicantDetail, 'name' | 'documents'>> }) => {
      await api.put(`/api/resource/Applicant/${encodeURIComponent(name)}`, input)
    },
    onSuccess: (_data, variables) => invalidateApplicant(queryClient, variables.name),
  })
}

export function useAddApplicantDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ applicant, documents, documentType, file }: { applicant: string; documents: FrappeApplicantDocument[]; documentType: string; file: File }) => {
      const fileUrl = await uploadFile(file, { isPrivate: true })
      const nextDocuments = [
        ...documents.map((d) => ({ document_type: d.document_type, attachment: d.attachment })),
        { document_type: documentType, attachment: fileUrl },
      ]
      await api.put(`/api/resource/Applicant/${encodeURIComponent(applicant)}`, { documents: nextDocuments })
    },
    onSuccess: (_data, variables) => invalidateApplicant(queryClient, variables.applicant),
  })
}

const APPLICANT_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.applicant.applicant'

export function useEnrolApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, mopseAdmissionNumber }: { name: string; mopseAdmissionNumber?: string }) => {
      const res = await api.post<{ message: string }>(`/api/method/${APPLICANT_MODULE}.enrol_applicant`, {
        name,
        mopse_admission_number: mopseAdmissionNumber || undefined,
      })
      return res.message
    },
    onSuccess: (_data, variables) => {
      invalidateApplicant(queryClient, variables.name)
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}
