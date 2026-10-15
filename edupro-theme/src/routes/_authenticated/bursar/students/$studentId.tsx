import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Pencil,
  PauseCircle,
  PlayCircle,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { BackLink } from '@/components/layout/back-link'
import { StudentFormDialog } from '@/components/student-form-dialog'
import { RecordPaymentDialog } from '@/components/record-payment-dialog'
import { StudentDocumentActions } from '@/components/student-document-actions'
import { buildProfileSections, buildStatementSections } from '@/lib/student-documents'
import { toast } from 'sonner'
import { useStudent, useGuardians, useUpdateStudent } from '@/lib/frappe/students'
import { formatUSD, zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { useSchoolSetup } from '@/lib/frappe/school-setup'
import { useStudentInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'
import { useStudentReceipts } from '@/lib/frappe/receipts'
import { Money } from '@/components/money'
import { StatusBadge } from '@/components/status-badge'
import { FrappeApiError } from '@/lib/frappe/client'
import { formatStudentName } from '@/lib/utils'

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'placement', label: 'Placement' },
  { key: 'guardians', label: 'Guardians' },
  { key: 'medical', label: 'Medical' },
  { key: 'sen', label: 'SEN' },
  { key: 'records', label: 'Records' },
  { key: 'activities', label: 'Activities' },
  { key: 'financial', label: 'Financial' },
] as const

type TabKey = (typeof TABS)[number]['key']

function getStatusBadgeClass(status: FeeStatus) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/10 text-emerald-600'
    case 'partial':
      return 'bg-amber-500/10 text-amber-600'
    case 'overdue':
      return 'bg-red-500/10 text-red-600'
    case 'pending':
      return 'bg-slate-500/10 text-slate-600'
    default:
      return ''
  }
}

function getStatusIcon(status: FeeStatus) {
  switch (status) {
    case 'paid':
      return <CheckCircle2 className='h-4 w-4' />
    case 'partial':
      return <Clock className='h-4 w-4' />
    case 'overdue':
      return <AlertCircle className='h-4 w-4' />
    case 'pending':
      return <CreditCard className='h-4 w-4' />
    default:
      return null
  }
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='text-sm'>{value || '—'}</p>
    </div>
  )
}

function StudentDetailPage() {
  const { studentId } = Route.useParams()
  const { tab } = Route.useSearch()
  const { data: student, isLoading, error } = useStudent(studentId)
  const { data: invoices } = useStudentInvoices(studentId)
  const { data: receipts } = useStudentReceipts(studentId)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const { data: schoolSetup } = useSchoolSetup()
  const [activeTab, setActiveTab] = useState<TabKey>(tab ?? 'profile')
  const [editOpen, setEditOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [profileDocOpen, setProfileDocOpen] = useState(false)
  const [statementDocOpen, setStatementDocOpen] = useState(false)
  const [destinationSchool, setDestinationSchool] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const updateStudent = useUpdateStudent()

  function receiptAmountUSD(r: { currency: string; amount: number }) {
    return r.currency === 'ZiG' ? zigToUsd(r.amount, zigPerUsd) : r.amount
  }

  // Student records are never deleted -- the school tracks every child from
  // day one. Suspended/Transferred Out (and Reactivate, undoing a Suspend)
  // are the only ways a student's standing changes here; anything else
  // (Withdrawn/Deceased/Graduated) goes through the full Edit form instead,
  // since those are rarer and worth double-checking in context.
  async function handleSuspend() {
    if (!student) return
    try {
      await updateStudent.mutateAsync({ name: student.name, status: 'Suspended' })
      toast.success(`${formatStudentName(student.first_name, student.last_name)} suspended`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not suspend this student.')
    } finally {
      setSuspendOpen(false)
    }
  }

  async function handleReactivate() {
    if (!student) return
    try {
      await updateStudent.mutateAsync({ name: student.name, status: 'Active' })
      toast.success(`${formatStudentName(student.first_name, student.last_name)} reactivated`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not reactivate this student.')
    }
  }

  async function handleTransfer() {
    if (!student) return
    if (!destinationSchool.trim()) {
      toast.error('Destination school is required.')
      return
    }
    try {
      await updateStudent.mutateAsync({
        name: student.name,
        status: 'Transferred Out',
        destination_school: destinationSchool,
        transfer_reason: transferReason || undefined,
        departure_date: departureDate || undefined,
      })
      toast.success(`${formatStudentName(student.first_name, student.last_name)} marked transferred out`)
      setTransferOpen(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this transfer.')
    }
  }

  const guardianNames = useMemo(
    () => [student?.guardian, student?.secondary_guardian].filter((g): g is string => !!g),
    [student?.guardian, student?.secondary_guardian]
  )
  const { data: guardians } = useGuardians(guardianNames)

  const { status: feeStatus, balanceUSD, paidUSD } = computeFeeStatus(invoices ?? [])
  const statement = useMemo(
    () => buildStatementSections(invoices ?? [], receipts ?? [], receiptAmountUSD, schoolSetup?.banking_configuration),
    [invoices, receipts, schoolSetup?.banking_configuration, zigPerUsd]
  )

  if (isLoading) {
    return (
      <>
        <BursarHeader />
        <Main>
          <p className='text-sm text-muted-foreground'>Loading student…</p>
        </Main>
      </>
    )
  }

  if (error || !student) {
    return (
      <>
        <BursarHeader />
        <Main>
          <BackLink to='/bursar/students' label='Back to students' />
          <p className='mt-4 text-sm text-destructive'>Couldn't load this student. They may not exist, or the server is unreachable.</p>
        </Main>
      </>
    )
  }

  const displayName = formatStudentName(student.first_name, student.last_name)

  return (
    <>
      <BursarHeader />

      <Main>
        <BackLink to='/bursar/students' label='Back to students' />

        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <GraduationCap className='h-6 w-6' />
            </div>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>{displayName}</h1>
              <p className='text-sm text-muted-foreground'>
                {student.name} • {student.grade ?? 'No grade set'} • {student.beneficiary_category}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' onClick={() => setEditOpen(true)}>
              <Pencil className='h-4 w-4' />
              Edit
            </Button>
            <Button variant='outline' onClick={() => setProfileDocOpen(true)}>
              <UserRound className='h-4 w-4' />
              Profile PDF
            </Button>
            <Button variant='outline' onClick={() => setStatementDocOpen(true)}>
              <FileText className='h-4 w-4' />
              Statement
            </Button>
            <Button onClick={() => setPayOpen(true)}>
              <CreditCard className='h-4 w-4' />
              Record payment
            </Button>
            {student.status === 'Active' && (
              <>
                <Button variant='outline' onClick={() => setSuspendOpen(true)}>
                  <PauseCircle className='h-4 w-4' />
                  Suspend
                </Button>
                <Button variant='outline' onClick={() => setTransferOpen(true)}>
                  <ArrowRightLeft className='h-4 w-4' />
                  Transfer out
                </Button>
              </>
            )}
            {student.status === 'Suspended' && (
              <Button variant='outline' onClick={handleReactivate} disabled={updateStudent.isPending}>
                <PlayCircle className='h-4 w-4' />
                Reactivate
              </Button>
            )}
          </div>
        </div>

        <StudentFormDialog key={String(editOpen)} open={editOpen} onOpenChange={setEditOpen} student={student} />
        <RecordPaymentDialog key={`${student.name}-${payOpen}`} open={payOpen} onOpenChange={setPayOpen} studentId={student.name} />

        <Dialog open={profileDocOpen} onOpenChange={setProfileDocOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Profile -- {displayName}</DialogTitle>
              <DialogDescription>{student.name}</DialogDescription>
            </DialogHeader>
            <StudentDocumentActions
              kind='profile'
              studentId={student.name}
              studentName={displayName}
              sections={buildProfileSections(student, guardians ?? [])}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={statementDocOpen} onOpenChange={setStatementDocOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Statement -- {displayName}</DialogTitle>
              <DialogDescription>{student.name} · {(invoices ?? []).length} invoices · {(receipts ?? []).length} receipts</DialogDescription>
            </DialogHeader>
            <StudentDocumentActions
              kind='statement'
              studentId={student.name}
              studentName={displayName}
              sections={statement.sections}
              summary={{ label: 'Total Balance', value: formatUSD(statement.totalBalanceUSD) }}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend {displayName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Their record and history stay exactly as they are -- this just marks them Suspended
                until you reactivate them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspend} disabled={updateStudent.isPending}>
                Suspend
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={transferOpen} onOpenChange={(o) => { setTransferOpen(o); if (o) { setDestinationSchool(''); setTransferReason(''); setDepartureDate('') } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer {displayName} out</DialogTitle>
              <DialogDescription>Their record and financial history are kept -- this marks them Transferred Out, not removed.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-3 py-2'>
              <CompactField label='Destination school' required>
                <Input className={compactControlClass} value={destinationSchool} onChange={(e) => setDestinationSchool(e.target.value)} placeholder='e.g. Borrowdale Primary School' />
              </CompactField>
              <CompactField label='Departure date'>
                <Input type='date' className={compactControlClass} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
              </CompactField>
              <CompactField label='Reason'>
                <Textarea className='text-sm' rows={2} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
              </CompactField>
            </div>
            <DialogFooter>
              <Button onClick={handleTransfer} disabled={updateStudent.isPending}>
                {updateStudent.isPending ? 'Recording…' : 'Record transfer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className='mb-6 grid gap-4 sm:grid-cols-3'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Fee status
              </CardTitle>
              <div className={`rounded-full p-2 ${getStatusBadgeClass(feeStatus)}`}>
                {getStatusIcon(feeStatus)}
              </div>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {feeStatus.charAt(0).toUpperCase() + feeStatus.slice(1)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Fees paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                <Money usd={paidUSD} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Outstanding balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                <Money usd={balanceUSD} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='mb-6 flex flex-wrap items-center gap-1 border-b'>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className='grid gap-4'>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Core Identity</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Date of birth' value={student.date_of_birth} />
                <Field label='Gender' value={student.gender} />
                <Field label='Admission date' value={student.admission_date} />
                <Field label='MoPSE admission number' value={student.mopse_admission_number} />
                <Field label='Academic year' value={student.academic_year} />
                <Field label='Current term' value={student.current_term} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Status & Lifecycle</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <div>
                  <p className='text-xs text-muted-foreground'>Enrollment status</p>
                  <StatusBadge tone={student.status === 'Active' ? 'good' : 'neutral'}>{student.status}</StatusBadge>
                </div>
                <Field label='Departure date' value={student.departure_date} />
                <Field label='Transfer reason' value={student.transfer_reason} />
                <Field label='Destination school' value={student.destination_school} />
                <Field label='Clearance certificate #' value={student.clearance_certificate_number} />
              </CardContent>
            </Card>
            <p className='text-xs text-muted-foreground'>
              Record created {student.creation} · last modified {student.modified}
            </p>
          </div>
        )}

        {activeTab === 'placement' && (
          <div className='grid gap-4'>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Academic Placement</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Class / stream' value={student.grade} />
                <Field label='Beneficiary category' value={student.beneficiary_category} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Boarding & Logistics</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Lunch scheme' value={student.lunch_scheme} />
                <Field label='Boarder' value={student.is_boarder ? 'Yes' : 'Day scholar'} />
                <Field label='Hostel / dormitory room' value={student.hostel_room} />
                <Field label='Bus route' value={student.bus_route} />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'guardians' && (
          <div className='grid gap-4'>
            {(guardians ?? []).length === 0 && (
              <p className='text-sm text-muted-foreground'>No guardians linked to this student.</p>
            )}
            {(guardians ?? []).map((guardian) => (
              <Card key={guardian.name}>
                <CardHeader className='border-b py-3'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-sm'>{guardian.full_name}</CardTitle>
                    {guardian.name === student.guardian && <StatusBadge tone='good'>Primary</StatusBadge>}
                  </div>
                </CardHeader>
                <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                  <Field label='Relationship' value={guardian.relationship} />
                  <Field label='Phone' value={guardian.phone_number} />
                  <Field label='Email' value={guardian.email} />
                  <Field label='Employer' value={guardian.employer} />
                  <Field label='Address' value={guardian.address} />
                </CardContent>
              </Card>
            ))}
            {student.court_order_on_file === 1 && (
              <p className='text-xs text-muted-foreground'>Court order on file. {student.legal_guardian_designation}</p>
            )}
          </div>
        )}

        {activeTab === 'medical' && (
          <div className='grid gap-4'>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Medical Overview</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Blood group' value={student.blood_group} />
                <Field label='Chronic conditions' value={student.chronic_conditions} />
                <Field label='Allergies' value={student.allergies} />
                <Field label='Medications' value={student.medications} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Emergency Contact</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Name' value={student.emergency_contact_name} />
                <Field label='Phone' value={student.emergency_contact_phone} />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'sen' && (
          <Card>
            <CardHeader className='border-b py-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-sm'>Special Educational Needs</CardTitle>
                <StatusBadge tone={student.has_sen ? 'warning' : 'neutral'}>{student.has_sen ? 'SEN on file' : 'No SEN on file'}</StatusBadge>
              </div>
            </CardHeader>
            {student.has_sen === 1 && (
              <CardContent className='pt-4'>
                <Field label='Notes' value={student.sen_notes} />
              </CardContent>
            )}
          </Card>
        )}

        {activeTab === 'records' && (
          <div className='grid gap-4'>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Academic History (Report Cards)</CardTitle></CardHeader>
              <CardContent className='pt-0'>
                {student.report_cards.length > 0 ? (
                  <div className='divide-y'>
                    {student.report_cards.map((h) => (
                      <div key={h.name} className='flex items-center justify-between py-3 text-sm'>
                        <span>{h.term}</span>
                        <span className='text-muted-foreground'>{h.aggregate_or_gpa ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='py-4 text-sm text-muted-foreground'>No report cards on file</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Disciplinary Records</CardTitle></CardHeader>
              <CardContent className='pt-0'>
                {student.disciplinary_records.length > 0 ? (
                  <div className='divide-y'>
                    {student.disciplinary_records.map((d) => (
                      <div key={d.name} className='py-3'>
                        <p className='text-sm'>{d.infraction}</p>
                        <p className='text-xs text-muted-foreground'>{d.incident_date} · {d.corrective_action ?? 'No action recorded'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='py-4 text-sm text-muted-foreground'>No disciplinary records</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'activities' && (
          <Card>
            <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Extracurricular</CardTitle></CardHeader>
            <CardContent className='pt-0'>
              {student.activities.length > 0 ? (
                <div className='divide-y'>
                  {student.activities.map((a) => (
                    <div key={a.name} className='flex items-center justify-between py-3 text-sm'>
                      <span>{a.activity_name} <span className='text-xs text-muted-foreground'>({a.activity_type})</span></span>
                      <span className='text-muted-foreground'>{a.role ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='py-4 text-sm text-muted-foreground'>No activities recorded</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'financial' && (
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>{(invoices ?? []).length} invoices on record</CardDescription>
            </CardHeader>
            <CardContent className='pt-0'>
              <div className='divide-y'>
                {(invoices ?? []).length > 0 ? (
                  (invoices ?? []).map((invoice) => (
                    <div
                      key={invoice.name}
                      className='flex items-center justify-between py-4'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600'>
                          <CheckCircle2 className='h-4 w-4' />
                        </div>
                        <div>
                          <p className='text-sm font-medium'>{invoice.name}</p>
                          <p className='text-xs text-muted-foreground'>{invoice.posting_date} · {invoice.status}</p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-sm font-semibold'><Money usd={invoice.total_amount} /></p>
                        {invoice.outstanding_amount > 0 && (
                          <p className='text-xs text-muted-foreground'>
                            <Money usd={invoice.outstanding_amount} /> outstanding
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='py-8 text-center'>
                    <p className='text-muted-foreground'>No invoices recorded yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/bursar/students/$studentId')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: TABS.some((t) => t.key === search.tab) ? (search.tab as TabKey) : undefined,
  }),
  component: StudentDetailPage,
})
