/**
 * Student doctype access -- see the backend repo's
 * edupro_school_fees/doctype/student/student.json for the full field set.
 * `name` is Frappe's own document id (e.g. STU-2026-00001), distinct from
 * the student's actual name (first_name/last_name).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import { useCurrentUser } from './auth'

export interface FrappeStudent {
  name: string
  first_name: string
  last_name: string
  grade?: string
  beneficiary_category: string
  status: string
  academic_year: string
  current_term?: string
  admission_date: string
  is_boarder: 0 | 1
}

export interface FrappeReportCard {
  name: string
  term: string
  aggregate_or_gpa?: string
  remarks?: string
}

export interface FrappeStudentActivity {
  name: string
  activity_type: string
  activity_name: string
  role?: string
}

export interface FrappeDisciplinaryRecord {
  name: string
  incident_date: string
  infraction: string
  hearing_notes?: string
  corrective_action?: string
}

export interface FrappeStudentDetail extends FrappeStudent {
  date_of_birth?: string
  gender?: string
  mopse_admission_number?: string
  home_address?: string
  hostel_room?: string
  bus_route?: string
  lunch_scheme?: string
  guardian?: string
  secondary_guardian?: string
  court_order_on_file: 0 | 1
  legal_guardian_designation?: string
  blood_group?: string
  allergies?: string
  chronic_conditions?: string
  medications?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  has_sen: 0 | 1
  sen_notes?: string
  report_cards: FrappeReportCard[]
  activities: FrappeStudentActivity[]
  disciplinary_records: FrappeDisciplinaryRecord[]
  departure_date?: string
  destination_school?: string
  transfer_reason?: string
  clearance_certificate_number?: string
  owner: string
  creation: string
  modified: string
}

const STUDENT_LIST_FIELDS = [
  'name',
  'first_name',
  'last_name',
  'grade',
  'beneficiary_category',
  'status',
  'academic_year',
  'current_term',
  'admission_date',
  'is_boarder',
]

export function useStudents(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['students'],
    enabled: options?.enabled,
    queryFn: async () => {
      const res = await listResource<FrappeStudent>('Student', {
        fields: JSON.stringify(STUDENT_LIST_FIELDS),
        order_by: 'last_name asc, first_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useStudent(name: string) {
  return useQuery({
    queryKey: ['student', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeStudentDetail }>(
          `/api/resource/Student/${encodeURIComponent(name)}`
        )
      ).data,
    enabled: !!name,
  })
}

/** Student.user is a unique Link to the logged-in Frappe User for that
 * student's own portal login -- left blank until a Student is manually
 * linked (there's no self-service invite flow for Students today, unlike
 * Parent Guardian's Portal Invitation, so this can legitimately resolve to
 * null for a real logged-in Student user until a System Manager links it
 * via the desk). */
type MyStudent = FrappeStudent & Pick<FrappeStudentDetail, 'guardian' | 'secondary_guardian'>

export function useMyStudent() {
  const { user } = useCurrentUser()
  return useQuery({
    queryKey: ['my-student', user?.name],
    queryFn: async () => {
      const res = await listResource<MyStudent>('Student', {
        fields: JSON.stringify([...STUDENT_LIST_FIELDS, 'guardian', 'secondary_guardian']),
        filters: JSON.stringify([['user', '=', user!.name]]),
        limit_page_length: '1',
      })
      return res.data[0] ?? null
    },
    enabled: !!user?.name,
  })
}

export interface NewStudentInput {
  first_name: string
  last_name: string
  date_of_birth?: string
  gender?: string
  admission_date: string
  academic_year: string
  beneficiary_category: string
  grade?: string
  guardian?: string
  status?: string
  home_address?: string
  departure_date?: string
  destination_school?: string
  transfer_reason?: string
}

export interface StudentDocumentVerification {
  valid: boolean
  reason?: string
  student?: string
  first_name?: string
  last_name?: string
  grade?: string
  status?: string
  school_name?: string
}

/** Guest-accessible confirmation that a Statement/Profile PDF's QR code
 * points at a real, current student -- see verify_student_document() in the
 * backend's student.py. Returns identity only, never balances or guardian
 * details (that narrower scope than Receipt's own now-open verification is
 * deliberate, not an oversight). */
export function useVerifyStudentDocument(studentName: string | undefined) {
  return useQuery({
    queryKey: ['student-document-verification', studentName],
    queryFn: async () =>
      (
        await api.get<{ message: StudentDocumentVerification }>(
          `/api/method/edupro_school_fees.edupro_school_fees.doctype.student.student.verify_student_document?student=${encodeURIComponent(studentName!)}`
        )
      ).message,
    enabled: !!studentName,
    retry: false,
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewStudentInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Student', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  })
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, ...input }: Partial<NewStudentInput> & { name: string }) => {
      await api.put(`/api/resource/Student/${encodeURIComponent(name)}`, input)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', variables.name] })
    },
  })
}

// Student records are never deleted by default (school policy: track every
// child from day one) -- Student.on_trash throws for every caller unless the
// backend's own delete_student_for_correction() set its one-call bypass
// flag first. useDeleteStudentForCorrection below is the only way to reach
// that path: it's a temporary, narrowly-scoped exception for the Bursar to
// clean up clear data-entry mistakes, not a general delete. Any Invoice the
// student has is cancelled (GL-reversing) along the way, since most Active
// students carry one from the opening-balance import; the backend still
// refuses a student with an actual recorded Receipt (real money received)
// -- use useUpdateStudent with a new status (Suspended/Withdrawn/Transferred
// Out/Deceased/Graduated) for that case instead.
export function useDeleteStudentForCorrection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ student, justification }: { student: string; justification: string }) => {
      await api.post('/api/method/edupro_school_fees.edupro_school_fees.doctype.student.student.delete_student_for_correction', {
        student,
        justification,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  })
}

export interface FrappeBeneficiaryCategory {
  name: string
  category_name: string
}

export function useBeneficiaryCategories() {
  return useQuery({
    queryKey: ['beneficiary-categories'],
    queryFn: async () => {
      const res = await listResource<FrappeBeneficiaryCategory>(
        'Beneficiary Category',
        {
          fields: JSON.stringify(['name', 'category_name']),
          order_by: 'category_name asc',
          limit_page_length: '0',
        }
      )
      return res.data
    },
  })
}

export interface FrappeGuardian {
  name: string
  full_name: string
  relationship?: string
  national_id?: string
  phone_number?: string
  email?: string
  employer?: string
  address?: string
  user?: string
}

const GUARDIAN_FIELDS = ['name', 'full_name', 'relationship', 'national_id', 'phone_number', 'email', 'employer', 'address', 'user']

/** Parent Guardian.user is a unique Link to that guardian's own portal
 * login -- populated by the working Portal Invitation flow (unlike
 * Student.user, see useMyStudent above). */
export function useMyGuardian() {
  const { user } = useCurrentUser()
  return useQuery({
    queryKey: ['my-guardian', user?.name],
    queryFn: async () => {
      const res = await listResource<FrappeGuardian>('Parent Guardian', {
        fields: JSON.stringify(GUARDIAN_FIELDS),
        filters: JSON.stringify([['user', '=', user!.name]]),
        limit_page_length: '1',
      })
      return res.data[0] ?? null
    },
    enabled: !!user?.name,
  })
}

/** A guardian can be linked via either Student.guardian (primary) or
 * Student.secondary_guardian -- DEF-027 fixed a bug where checking only the
 * primary field wrongly denied portal access to a secondary guardian, so
 * both are always checked and deduped here, mirroring the backend's own
 * permissions.py::_guardian_student_names(). */
export function useMyChildren(guardianName: string | undefined) {
  return useQuery({
    queryKey: ['my-children', guardianName],
    queryFn: async () => {
      const [primary, secondary] = await Promise.all([
        listResource<FrappeStudent>('Student', {
          fields: JSON.stringify(STUDENT_LIST_FIELDS),
          filters: JSON.stringify([['guardian', '=', guardianName]]),
          limit_page_length: '0',
        }),
        listResource<FrappeStudent>('Student', {
          fields: JSON.stringify(STUDENT_LIST_FIELDS),
          filters: JSON.stringify([['secondary_guardian', '=', guardianName]]),
          limit_page_length: '0',
        }),
      ])
      const byName = new Map<string, FrappeStudent>()
      for (const s of [...primary.data, ...secondary.data]) byName.set(s.name, s)
      return [...byName.values()]
    },
    enabled: !!guardianName,
  })
}

export function useGuardians(names: string[]) {
  return useQuery({
    queryKey: ['guardians', names],
    queryFn: async () => {
      const res = await listResource<FrappeGuardian>('Parent Guardian', {
        fields: JSON.stringify(GUARDIAN_FIELDS),
        filters: JSON.stringify([['name', 'in', names]]),
        limit_page_length: '0',
      })
      return res.data
    },
    enabled: names.length > 0,
  })
}

/** All guardians, for the Bursar's Guardians roster -- distinct from
 * useMyGuardian (a portal user's own single record) and useGuardians
 * (a bulk lookup by known names). */
export function useAllGuardians() {
  return useQuery({
    queryKey: ['all-guardians'],
    queryFn: async () => {
      const res = await listResource<FrappeGuardian>('Parent Guardian', {
        fields: JSON.stringify(GUARDIAN_FIELDS),
        order_by: 'full_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewGuardianInput {
  full_name: string
  relationship?: string
  national_id?: string
  phone_number?: string
  email?: string
}

export function useCreateGuardian() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewGuardianInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Parent Guardian', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-guardians'] }),
  })
}

export interface PortalInvitationResult {
  invitation: string
  token: string
  delivery_channel: 'Phone' | 'Email'
  delivery_target: string
  expires_at: string
}

/** Issues a Portal Invitation token and attempts to deliver it by SMS/email
 * -- see create_portal_invitation() in the backend's portal_invitations.py
 * (Bursar/School-Head-only, rate-limited). Delivery never raises even if it
 * fails or isn't configured, so the raw invite link is always returned too
 * -- callers should show it so a Bursar can relay it out-of-band. Confirmed
 * real gap: this endpoint existed and was fully built, but no page called
 * it -- no one could invite a family to the portal at all. */
export function useCreatePortalInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (parentGuardian: string) => {
      const res = await api.post<{ message: PortalInvitationResult }>(
        '/api/method/edupro_school_fees.portal_invitations.create_portal_invitation',
        { parent_guardian: parentGuardian }
      )
      return res.message
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-guardians'] }),
  })
}

/** Every Student's guardian links, for deriving each guardian's linked
 * children on the Guardians roster without an N+1 query per row -- one
 * fetch, filtered client-side, same guardian/secondary_guardian pairing as
 * useMyChildren above. */
export function useStudentGuardianLinks() {
  return useQuery({
    queryKey: ['student-guardian-links'],
    queryFn: async () => {
      const res = await listResource<Pick<FrappeStudent, 'name' | 'first_name' | 'last_name' | 'grade'> & Pick<FrappeStudentDetail, 'guardian' | 'secondary_guardian'>>('Student', {
        fields: JSON.stringify(['name', 'first_name', 'last_name', 'grade', 'guardian', 'secondary_guardian']),
        limit_page_length: '0',
      })
      return res.data
    },
  })
}
