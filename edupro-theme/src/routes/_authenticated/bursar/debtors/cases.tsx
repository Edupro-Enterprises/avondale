import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, ChevronDown, ChevronRight, Gavel, HandCoins, Paperclip, Plus, Search, ShieldCheck, TriangleAlert, UserRoundSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { formatUSD } from '@/lib/currency'
import { formatStudentName } from '@/lib/utils'
import {
  useDebtorCases,
  useDebtorCase,
  useSetDebtorCaseState,
  useCreateDebtorCase,
  useMoveCaseToLegal,
  useAssignDebtorCase,
  useLogAcknowledgmentOfDebt,
  useRecordPromise,
  useAgeingSummary,
  isPromiseBroken,
  type FrappeDebtorCase,
  type AgeingBucket,
  type DebtorCaseStatus,
} from '@/lib/frappe/debtor-cases'
import { useStudents, useGuardians } from '@/lib/frappe/students'
import { useStudentInvoices } from '@/lib/frappe/invoices'
import { useStudentPaymentPlan } from '@/lib/frappe/payment-plans'
import { useCommunications } from '@/lib/frappe/communications'
import { useUsers } from '@/lib/frappe/users'
import { useOutstandingFeesReport } from '@/lib/frappe/reports'

export const Route = createFileRoute('/_authenticated/bursar/debtors/cases')({
  component: DebtorCasesPage,
})

const statusTone: Record<DebtorCaseStatus, StatusTone> = {
  Open: 'neutral',
  'Payment Plan Active': 'info',
  Escalated: 'bad',
  Legal: 'bad',
  Resolved: 'good',
}

const bucketTone: Record<AgeingBucket, StatusTone> = {
  Current: 'good',
  '1-30 Days': 'warning',
  '31-60 Days': 'warning',
  '61-90 Days': 'bad',
  '90+ Days': 'bad',
}

const BUCKETS: AgeingBucket[] = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days']
const bucketColor: Record<AgeingBucket, string> = {
  Current: 'var(--status-good)',
  '1-30 Days': 'var(--status-warning)',
  '31-60 Days': 'var(--status-warning)',
  '61-90 Days': 'var(--status-bad)',
  '90+ Days': 'var(--status-bad)',
}

function Disclosure({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className='rounded-md border'>
      <button type='button' onClick={() => setOpen((o) => !o)} className='flex w-full items-center justify-between px-3 py-2 text-sm font-medium'>
        <span>{title} ({count})</span>
        {open ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
      </button>
      {open && <div className='divide-y border-t'>{children}</div>}
    </div>
  )
}

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'bucket', label: 'Ageing bucket', options: ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days'] },
  { key: 'promise', label: 'Promise to pay', options: ['Broken'] },
]

function DebtorCasesPage() {
  const { data: cases, isLoading, error } = useDebtorCases()
  const { data: students } = useStudents()
  const { data: outstandingFees } = useOutstandingFeesReport()
  const { data: ageingSummary } = useAgeingSummary()
  const filters = useFilters('debtor-cases', FILTER_GROUPS)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [escalating, setEscalating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [movingToLegal, setMovingToLegal] = useState(false)
  const [legalNotes, setLegalNotes] = useState('')
  const [promising, setPromising] = useState(false)
  const [promiseAmount, setPromiseAmount] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseNotes, setPromiseNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [newOpen, setNewOpen] = useState(false)
  const [newStudent, setNewStudent] = useState('')
  const [newStudentQuery, setNewStudentQuery] = useState('')

  const { data: selected } = useDebtorCase(selectedName ?? undefined)
  const { data: debtInvoices } = useStudentInvoices(selected?.student ?? '')
  const { data: studentPlan } = useStudentPaymentPlan(selected?.student)
  const { data: allCommunications } = useCommunications()
  const { data: users } = useUsers()
  const guardianNames = useMemo(
    () => [selected?.parent_guardian].filter((g): g is string => !!g),
    [selected?.parent_guardian]
  )
  const { data: guardians } = useGuardians(guardianNames)
  const guardian = guardians?.[0]

  const caseCommunications = useMemo(
    () => (allCommunications ?? []).filter((c) => c.debtor_case === selected?.name || (!!selected?.student && c.student === selected.student)),
    [allCommunications, selected?.name, selected?.student]
  )
  const assignableUsers = useMemo(
    () => (users ?? []).filter((u) => u.enabled && (u.roles.includes('Bursar') || u.roles.includes('School Head'))),
    [users]
  )

  const setState = useSetDebtorCaseState()
  const createCase = useCreateDebtorCase()
  const moveToLegal = useMoveCaseToLegal()
  const assignCase = useAssignDebtorCase()
  const logAoD = useLogAcknowledgmentOfDebt()
  const recordPromise = useRecordPromise()

  const ageingChartData = useMemo(
    () => BUCKETS.map((bucket) => ({ bucket, outstanding: ageingSummary?.[bucket]?.outstanding_amount ?? 0, count: ageingSummary?.[bucket]?.case_count ?? 0 })),
    [ageingSummary]
  )

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) map.set(s.name, formatStudentName(s.first_name, s.last_name))
    return map
  }, [students])

  const rows = useMemo(() => cases ?? [], [cases])

  // Excludes students who already have a non-Resolved case, so "New case"
  // can't create a second open case for the same student.
  const studentsWithActiveCase = useMemo(
    () => new Set(rows.filter((c) => c.workflow_state !== 'Resolved').map((c) => c.student)),
    [rows]
  )
  // Sourced from the Outstanding Fees report, not the whole student roster --
  // "New case" is for opening a debt-collection case, so it should only ever
  // offer students who actually owe money, with the amount right there to
  // help pick the right one, not an alphabetical list of every student in
  // the school.
  const eligibleDebtors = useMemo(
    () => (outstandingFees?.rows ?? []).filter((r) => !studentsWithActiveCase.has(r.student)),
    [outstandingFees, studentsWithActiveCase]
  )
  const newStudentMatches = useMemo(() => {
    const q = newStudentQuery.trim().toLowerCase()
    if (!q) return eligibleDebtors
    return eligibleDebtors.filter((r) => formatStudentName(r.first_name, r.last_name).toLowerCase().includes(q) || r.student.toLowerCase().includes(q))
  }, [eligibleDebtors, newStudentQuery])
  const newStudentPicked = eligibleDebtors.find((r) => r.student === newStudent)

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((c) => {
      const studentName = studentNames.get(c.student) ?? c.student
      const matchesSearch = studentName.toLowerCase().includes(search)
      const matchesBucket = !filters.values.bucket || c.ageing_bucket === filters.values.bucket
      const matchesPromise = !filters.values.promise || isPromiseBroken(c)
      return matchesSearch && matchesBucket && matchesPromise
    })
  }, [rows, studentNames, filters.search, filters.values])

  const columns: DataListColumn<FrappeDebtorCase>[] = [
    { id: 'student', header: 'Student', sortable: true, sortValue: (c) => studentNames.get(c.student) ?? c.student, className: 'min-w-32', cell: (c) => studentNames.get(c.student) ?? c.student },
    { id: 'id', header: 'Case ID', sortable: true, sortValue: (c) => c.name, cell: (c) => c.name },
    {
      id: 'outstanding',
      header: 'Outstanding',
      sortable: true,
      sortValue: (c) => c.outstanding_amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (c) => <Money usd={c.outstanding_amount} />,
    },
    {
      id: 'bucket',
      header: 'Ageing',
      sortable: true,
      sortValue: (c) => c.ageing_bucket,
      cell: (c) => <StatusBadge tone={bucketTone[c.ageing_bucket]}>{c.ageing_bucket}</StatusBadge>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (c) => c.workflow_state,
      cell: (c) => <StatusBadge tone={statusTone[c.workflow_state]}>{c.workflow_state}</StatusBadge>,
    },
    {
      id: 'promise',
      header: 'Promise to pay',
      cell: (c) =>
        isPromiseBroken(c) ? (
          <StatusBadge tone='bad'>Broken · {c.promised_by_date}</StatusBadge>
        ) : c.promised_by_date ? (
          <span className='text-xs text-muted-foreground'>By {c.promised_by_date}</span>
        ) : (
          <span className='text-xs text-muted-foreground'>—</span>
        ),
    },
  ]

  const debtItems = (debtInvoices ?? []).filter((inv) => inv.outstanding_amount > 0)

  async function handleEscalate() {
    if (!selected) return
    try {
      await setState.mutateAsync({ name: selected.name, workflow_state: 'Escalated' })
      toast.success(`${studentNames.get(selected.student) ?? selected.student}'s case escalated`)
      setEscalating(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not escalate this case.')
    }
  }

  async function handleResolve() {
    if (!selected) return
    try {
      await setState.mutateAsync({ name: selected.name, workflow_state: 'Resolved' })
      toast.success(`${studentNames.get(selected.student) ?? selected.student}'s case resolved`)
      setResolving(false)
      setSelectedName(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not resolve this case.')
    }
  }

  async function handleMoveToLegal() {
    if (!selected) return
    if (!legalNotes.trim()) {
      toast.error('Notes are required to move a case to legal action.')
      return
    }
    try {
      await moveToLegal.mutateAsync({ name: selected.name, notes: legalNotes.trim() })
      toast.success(`${studentNames.get(selected.student) ?? selected.student}'s case moved to legal action`)
      setMovingToLegal(false)
      setLegalNotes('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not move this case to legal action.')
    }
  }

  async function handleCreateCase() {
    if (!newStudent) {
      toast.error('Pick a student.')
      return
    }
    try {
      const name = await createCase.mutateAsync(newStudent)
      toast.success(`${name} opened`)
      setNewOpen(false)
      setNewStudent('')
      setNewStudentQuery('')
      setSelectedName(name)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not open this case.')
    }
  }

  async function handleAssign(userEmail: string) {
    if (!selected) return
    try {
      await assignCase.mutateAsync({ name: selected.name, assigned_to: userEmail === '__unassigned__' ? null : userEmail })
      toast.success('Case assignment updated')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update the assignment.')
    }
  }

  function openPromiseDialog() {
    setPromiseAmount(selected?.promised_amount ? String(selected.promised_amount) : '')
    setPromiseDate(selected?.promised_by_date ?? '')
    setPromiseNotes(selected?.promise_notes ?? '')
    setPromising(true)
  }

  async function handleRecordPromise() {
    if (!selected) return
    const amount = Number(promiseAmount)
    if (!amount || amount <= 0 || !promiseDate) {
      toast.error('A promised amount and date are required.')
      return
    }
    try {
      await recordPromise.mutateAsync({ name: selected.name, promised_amount: amount, promised_by_date: promiseDate, promise_notes: promiseNotes.trim() || undefined })
      toast.success('Promise to pay recorded')
      setPromising(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this promise.')
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selected) return
    try {
      await logAoD.mutateAsync({ name: selected.name, file })
      toast.success('Acknowledgment of Debt logged')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not upload this document.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Debtor Management</p>
            <h1 className='text-3xl font-bold tracking-tight'>Debtor Cases</h1>
          </div>
          <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) { setNewStudent(''); setNewStudentQuery('') } }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />New case</Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-sm'>
              <DialogHeader>
                <DialogTitle>Open a debtor case</DialogTitle>
                <DialogDescription>Only students with an outstanding balance who don't already have a case are shown.</DialogDescription>
              </DialogHeader>
              <div className='grid gap-2 py-2'>
                {newStudentPicked ? (
                  <div className='flex items-center justify-between rounded-md border px-3 py-2'>
                    <div>
                      <p className='font-medium'>{formatStudentName(newStudentPicked.first_name, newStudentPicked.last_name)}</p>
                      <p className='text-xs text-muted-foreground'>{newStudentPicked.student} · {newStudentPicked.grade ?? 'No grade'}</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Money usd={newStudentPicked.outstanding_amount} compact />
                      <Button variant='ghost' size='sm' className='h-6 px-2 text-xs' onClick={() => setNewStudent('')}>Change</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className='relative'>
                      <Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
                      <Input
                        className='pl-8'
                        placeholder='Search by name or student number…'
                        value={newStudentQuery}
                        onChange={(e) => setNewStudentQuery(e.target.value)}
                      />
                    </div>
                    <div className='max-h-56 divide-y overflow-y-auto rounded-md border'>
                      {newStudentMatches.length === 0 && (
                        <p className='px-3 py-2 text-sm text-muted-foreground'>
                          {eligibleDebtors.length === 0 ? 'No student with an outstanding balance is without a case.' : 'No students match.'}
                        </p>
                      )}
                      {newStudentMatches.map((r) => (
                        <button
                          key={r.student}
                          type='button'
                          className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50'
                          onClick={() => setNewStudent(r.student)}
                        >
                          <div>
                            <p>{formatStudentName(r.first_name, r.last_name)}</p>
                            <p className='text-xs text-muted-foreground'>{r.student} · {r.grade ?? 'No grade'}</p>
                          </div>
                          <Money usd={r.outstanding_amount} compact />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreateCase} disabled={createCase.isPending || !newStudent}>{createCase.isPending ? 'Opening…' : 'Open case'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load debtor cases from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card className='mb-6'>
          <CardHeader className='flex flex-row items-center gap-3 space-y-0'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <CalendarClock className='h-4 w-4' />
            </div>
            <div>
              <CardTitle>Outstanding by ageing bucket</CardTitle>
              <CardDescription>Open and escalated cases, school-wide — click a bar to filter the list below</CardDescription>
            </div>
          </CardHeader>
          <CardContent className='h-56'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={ageingChartData}>
                <XAxis dataKey='bucket' className='text-xs' />
                <YAxis className='text-xs' tickFormatter={(v) => formatUSD(v)} />
                <Tooltip formatter={(v, k) => (k === 'outstanding' ? formatUSD(Number(v)) : v)} labelFormatter={(l) => l} />
                <Bar dataKey='outstanding' name='Outstanding' radius={4} className='cursor-pointer'>
                  {ageingChartData.map((row) => (
                    <Cell
                      key={row.bucket}
                      fill={bucketColor[row.bucket]}
                      fillOpacity={filters.values.bucket && filters.values.bucket !== row.bucket ? 0.4 : 1}
                      onClick={() => filters.setValue('bucket', row.bucket)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All cases</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by student…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(c) => c.name}
              isLoading={isLoading}
              onRowClick={(c) => setSelectedName(c.name)}
              densityStorageKey='debtor-cases'
              emptyState={{
                icon: UserRoundSearch,
                title: 'No debtor cases found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Debtor cases will appear here once created.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent className='max-h-[85vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>{selected ? studentNames.get(selected.student) ?? selected.student : ''}</DialogTitle>
              <DialogDescription>{selected?.name}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Outstanding</span><Money usd={selected.outstanding_amount} /></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Ageing</span><span>{selected.ageing_bucket} ({selected.days_overdue ?? 0}d overdue)</span></div>
                {selected.last_reminder_stage && selected.last_reminder_stage !== 'None' && (
                  <div className='flex justify-between'><span className='text-muted-foreground'>Last reminder sent</span><span>{selected.last_reminder_stage}</span></div>
                )}
                <div className='flex justify-between'><span className='text-muted-foreground'>Guardian</span><span>{guardian?.full_name ?? '—'}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Opened</span><span>{selected.opened_on ?? '—'}</span></div>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>Assigned to</span>
                  <Select value={selected.assigned_to || '__unassigned__'} onValueChange={handleAssign}>
                    <SelectTrigger className='h-8 w-48 text-sm'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__unassigned__'>Unassigned</SelectItem>
                      {assignableUsers.map((u) => <SelectItem key={u.name} value={u.name}>{u.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selected.acknowledgment_of_debt && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Acknowledgment of Debt</span>
                    <a href={selected.acknowledgment_of_debt} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-primary hover:underline'>
                      <Paperclip className='h-3.5 w-3.5' /> View
                    </a>
                  </div>
                )}
                {selected.legal_escalation_notes && (
                  <div>
                    <p className='text-muted-foreground'>Legal escalation notes</p>
                    <p>{selected.legal_escalation_notes}</p>
                  </div>
                )}

                <div className='rounded-md border p-3'>
                  <div className='flex items-center justify-between'>
                    <span className='flex items-center gap-1.5 font-medium'><HandCoins className='h-4 w-4' />Promise to pay</span>
                    {isPromiseBroken(selected) && <StatusBadge tone='bad'>Broken</StatusBadge>}
                  </div>
                  {selected.promised_by_date ? (
                    <div className='mt-2 space-y-1 text-muted-foreground'>
                      <div className='flex justify-between'><span>Promised</span><Money usd={selected.promised_amount ?? 0} /></div>
                      <div className='flex justify-between'><span>By</span><span>{selected.promised_by_date}</span></div>
                      {selected.promise_notes && <p className='pt-1'>{selected.promise_notes}</p>}
                    </div>
                  ) : (
                    <p className='mt-1 text-muted-foreground'>No promise recorded yet.</p>
                  )}
                  <Button variant='outline' size='sm' className='mt-2' onClick={openPromiseDialog}>
                    {selected.promised_by_date ? 'Update promise' : 'Record promise'}
                  </Button>
                </div>

                <Disclosure title='Debt items' count={debtItems.length}>
                  {debtItems.map((inv) => (
                    <div key={inv.name} className='flex items-center justify-between px-3 py-2'>
                      <div>
                        <p>{inv.name}</p>
                        <p className='text-xs text-muted-foreground'>due {inv.due_date ?? '—'}</p>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Money usd={inv.outstanding_amount} />
                        <StatusBadge tone='bad'>{inv.status}</StatusBadge>
                      </div>
                    </div>
                  ))}
                </Disclosure>

                <Disclosure title='Payment plan' count={studentPlan ? studentPlan.installments.length : 0}>
                  {!studentPlan && <p className='px-3 py-2 text-muted-foreground'>No payment plan for this student.</p>}
                  {studentPlan?.installments.map((inst) => (
                    <div key={inst.name} className='flex items-center justify-between px-3 py-2'>
                      <p>{inst.due_date}</p>
                      <div className='flex items-center gap-2'>
                        <Money usd={inst.amount} compact />
                        <StatusBadge tone={inst.status === 'Paid' ? 'good' : inst.status === 'Overdue' ? 'bad' : 'neutral'}>{inst.status}</StatusBadge>
                      </div>
                    </div>
                  ))}
                </Disclosure>

                <Disclosure title='Communication history' count={caseCommunications.length}>
                  {caseCommunications.length === 0 && <p className='px-3 py-2 text-muted-foreground'>No contact logged yet.</p>}
                  {caseCommunications.map((c) => (
                    <div key={c.name} className='px-3 py-2'>
                      <div className='flex items-center justify-between'>
                        <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                          <StatusBadge tone='neutral'>{c.channel}</StatusBadge>
                          {c.logged_on}
                        </span>
                        <span className='text-xs text-muted-foreground'>{c.logged_by}</span>
                      </div>
                      <p className='mt-1'>{c.summary}</p>
                    </div>
                  ))}
                </Disclosure>
              </div>
            )}
            <DialogFooter className='gap-2 sm:gap-2'>
              <input ref={fileInputRef} type='file' className='hidden' onChange={handleFileChosen} />
              <Button variant='outline' onClick={() => fileInputRef.current?.click()} disabled={logAoD.isPending}>
                {logAoD.isPending ? 'Uploading…' : 'Log AoD'}
              </Button>
              <Button
                variant='outline'
                onClick={() => setResolving(true)}
                disabled={!selected || selected.outstanding_amount > 0 || selected.workflow_state === 'Resolved'}
                title={selected && selected.outstanding_amount > 0 ? 'Still has an outstanding balance' : undefined}
              >
                <ShieldCheck className='h-4 w-4' />
                Resolve
              </Button>
              <Button
                variant='destructive'
                onClick={() => setEscalating(true)}
                disabled={selected?.workflow_state === 'Escalated' || selected?.workflow_state === 'Legal' || selected?.workflow_state === 'Resolved'}
              >
                <TriangleAlert className='h-4 w-4' />
                Escalate
              </Button>
              <Button
                variant='destructive'
                onClick={() => { setLegalNotes(selected?.legal_escalation_notes ?? ''); setMovingToLegal(true) }}
                disabled={selected?.workflow_state !== 'Escalated'}
                title={selected && selected.workflow_state !== 'Escalated' ? 'Escalate the case first' : undefined}
              >
                <Gavel className='h-4 w-4' />
                Move to legal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={escalating}
          onOpenChange={setEscalating}
          title={`Escalate ${selected ? studentNames.get(selected.student) ?? selected.student : ''}'s case?`}
          desc='Flags this case for senior follow-up. Move it to legal action separately once escalation alone hasn’t resolved it.'
          confirmText='Escalate'
          destructive
          handleConfirm={handleEscalate}
          className='sm:max-w-sm'
        />

        <ConfirmDialog
          open={resolving}
          onOpenChange={setResolving}
          title={`Resolve ${selected ? studentNames.get(selected.student) ?? selected.student : ''}'s case?`}
          desc='The balance is fully paid, so this closes the case. It can be reopened later if new debt accrues.'
          confirmText='Resolve'
          handleConfirm={handleResolve}
          isLoading={setState.isPending}
          className='sm:max-w-sm'
        />

        <Dialog open={movingToLegal} onOpenChange={(o) => { setMovingToLegal(o); if (!o) setLegalNotes('') }}>
          <DialogContent className='sm:max-w-sm'>
            <DialogHeader>
              <DialogTitle>Move {selected ? studentNames.get(selected.student) ?? selected.student : ''}'s case to legal action?</DialogTitle>
              <DialogDescription>Notes are kept on the case as the legal record.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-2 py-2'>
              <Textarea rows={4} className='text-sm' placeholder='Why is this going to legal action?' value={legalNotes} onChange={(e) => setLegalNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant='destructive' onClick={handleMoveToLegal} disabled={moveToLegal.isPending}>
                {moveToLegal.isPending ? 'Saving…' : 'Move to legal'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={promising} onOpenChange={setPromising}>
          <DialogContent className='sm:max-w-sm'>
            <DialogHeader><DialogTitle>Record a promise to pay</DialogTitle></DialogHeader>
            <div className='grid gap-3 py-2'>
              <CompactField label='Promised amount (USD)'>
                <Input className={compactControlClass} type='number' min='0' step='0.01' value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} />
              </CompactField>
              <CompactField label='By date'>
                <Input className={compactControlClass} type='date' value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
              </CompactField>
              <CompactField label='Notes'>
                <Textarea rows={3} className='text-sm' placeholder='Optional' value={promiseNotes} onChange={(e) => setPromiseNotes(e.target.value)} />
              </CompactField>
            </div>
            <DialogFooter>
              <Button onClick={handleRecordPromise} disabled={recordPromise.isPending}>
                {recordPromise.isPending ? 'Saving…' : 'Save promise'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
