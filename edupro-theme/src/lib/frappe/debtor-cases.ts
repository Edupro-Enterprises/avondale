/** Debtor Case doctype access -- see the backend repo's
 * edupro_school_fees/doctype/debtor_case/debtor_case.json. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource, uploadFile } from './client'

export type AgeingBucket = 'Current' | '1-30 Days' | '31-60 Days' | '61-90 Days' | '90+ Days'
export type DebtorCaseStatus = 'Open' | 'Payment Plan Active' | 'Escalated' | 'Resolved' | 'Legal'
export type ReminderStage = 'None' | 'First' | 'Second' | 'Escalation'

export interface FrappeDebtorCase {
  name: string
  student: string
  parent_guardian?: string
  outstanding_amount: number
  ageing_bucket: AgeingBucket
  workflow_state: DebtorCaseStatus
  assigned_to?: string
  promised_amount?: number
  promised_by_date?: string
  days_overdue?: number
  last_reminder_stage?: ReminderStage
}

const DEBTOR_CASE_FIELDS = [
  'name',
  'student',
  'parent_guardian',
  'outstanding_amount',
  'ageing_bucket',
  'workflow_state',
  'assigned_to',
  'promised_amount',
  'promised_by_date',
  'days_overdue',
  'last_reminder_stage',
]

/** A promise is broken once its date has passed and the case still owes
 * money -- never stored server-side (it would go stale the instant "today"
 * moves on), always derived at read time from the two real fields. */
export function isPromiseBroken(c: Pick<FrappeDebtorCase, 'promised_by_date' | 'outstanding_amount'>): boolean {
  return !!c.promised_by_date && c.promised_by_date < new Date().toISOString().slice(0, 10) && c.outstanding_amount > 0
}

export function useDebtorCases(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['debtor-cases'],
    enabled: options?.enabled,
    queryFn: async () => {
      const res = await listResource<FrappeDebtorCase>('Debtor Case', {
        fields: JSON.stringify(DEBTOR_CASE_FIELDS),
        order_by: 'modified desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeDebtorCaseDetail extends FrappeDebtorCase {
  acknowledgment_of_debt?: string
  legal_escalation_notes?: string
  promise_notes?: string
  opened_on?: string
  resolved_on?: string
}

export function useDebtorCase(name: string | undefined) {
  return useQuery({
    queryKey: ['debtor-case', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeDebtorCaseDetail }>(
          `/api/resource/Debtor Case/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}

function invalidateCase(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['debtor-cases'] })
  queryClient.invalidateQueries({ queryKey: ['debtor-case'] })
}

/** assigned_to exists on the doctype specifically to hand a case to a staff
 * member for follow-up -- confirmed real gap: nothing in the app ever set
 * it, so it sat unused despite being designed for exactly this. */
export function useAssignDebtorCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, assigned_to }: { name: string; assigned_to: string | null }) => {
      await api.put(`/api/resource/Debtor Case/${encodeURIComponent(name)}`, { assigned_to })
    },
    onSuccess: () => invalidateCase(queryClient),
  })
}

export function useSetDebtorCaseState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, workflow_state }: { name: string; workflow_state: DebtorCaseStatus }) => {
      await api.put(`/api/resource/Debtor Case/${encodeURIComponent(name)}`, { workflow_state })
    },
    onSuccess: () => invalidateCase(queryClient),
  })
}

/** Confirmed real gap: nothing in the app ever called this -- the whole
 * ageing/reminder/escalation engine (run_debtor_ageing_escalation) only
 * ever updates a case that already exists, and nothing created one
 * automatically either, so the module never actually ran for real
 * students. parent_guardian is fetch_from=student.guardian on the
 * backend, so it's set automatically from just `student`. */
export function useCreateDebtorCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (student: string) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Debtor Case', { student })
      return created.data.name
    },
    onSuccess: () => invalidateCase(queryClient),
  })
}

/** Escalated -> Legal, the one workflow_state the UI never had a path to
 * before -- distinct from "Escalate" (Open/Payment Plan Active ->
 * Escalated), which is a different step. Records why alongside the
 * transition, the same field the case detail view already shows. */
export function useMoveCaseToLegal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, notes }: { name: string; notes: string }) => {
      await api.put(`/api/resource/Debtor Case/${encodeURIComponent(name)}`, {
        workflow_state: 'Legal',
        legal_escalation_notes: notes,
      })
    },
    onSuccess: () => invalidateCase(queryClient),
  })
}

export function useRecordPromise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      promised_amount,
      promised_by_date,
      promise_notes,
    }: {
      name: string
      promised_amount: number
      promised_by_date: string
      promise_notes?: string
    }) => {
      await api.put(`/api/resource/Debtor Case/${encodeURIComponent(name)}`, {
        promised_amount,
        promised_by_date,
        promise_notes,
      })
    },
    onSuccess: () => invalidateCase(queryClient),
  })
}

export interface AgeingSummaryBucket {
  case_count: number
  outstanding_amount: number
}

/** See the backend repo's debtor_case.py get_ageing_summary() -- aggregates
 * every open case's outstanding amount per ageing bucket, school-wide. */
export function useAgeingSummary() {
  return useQuery({
    queryKey: ['debtor-cases', 'ageing-summary'],
    queryFn: async () =>
      (
        await api.get<{ message: Record<AgeingBucket, AgeingSummaryBucket> }>(
          '/api/method/edupro_school_fees.edupro_school_fees.doctype.debtor_case.debtor_case.get_ageing_summary'
        )
      ).message,
  })
}

/** acknowledgment_of_debt is a plain Attach field on Debtor Case itself --
 * uploads the file then points the field at it, same two-step Frappe
 * always needs for a file field. */
export function useLogAcknowledgmentOfDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const fileUrl = await uploadFile(file, { isPrivate: true })
      await api.put(`/api/resource/Debtor Case/${encodeURIComponent(name)}`, {
        acknowledgment_of_debt: fileUrl,
      })
      return fileUrl
    },
    onSuccess: () => invalidateCase(queryClient),
  })
}
