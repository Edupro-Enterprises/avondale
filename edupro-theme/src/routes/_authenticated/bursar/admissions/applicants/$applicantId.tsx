import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GraduationCap, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { BackLink } from '@/components/layout/back-link'
import { StatusBadge } from '@/components/status-badge'
import { Money } from '@/components/money'
import { FrappeApiError } from '@/lib/frappe/client'
import { useBeneficiaryCategories } from '@/lib/frappe/students'
import {
  useApplicant,
  useUpdateApplicant,
  useAddApplicantDocument,
  useEnrolApplicant,
  type FrappeApplicantDetail,
} from '@/lib/frappe/applicants'

export const Route = createFileRoute('/_authenticated/bursar/admissions/applicants/$applicantId')({
  component: ApplicantDetailPage,
})

const TABS = [
  { key: 'application', label: 'Application' },
  { key: 'academic', label: 'Academic History' },
  { key: 'guardian', label: 'Guardian' },
  { key: 'documents', label: 'Documents' },
  { key: 'decision', label: 'Decision' },
] as const

type TabKey = (typeof TABS)[number]['key']

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='text-sm'>{value || '—'}</p>
    </div>
  )
}

function ApplicantDetailPage() {
  const { applicantId } = Route.useParams()
  const { data: applicant, isLoading, error } = useApplicant(applicantId)
  const { data: beneficiaryCategories } = useBeneficiaryCategories()
  const updateApplicant = useUpdateApplicant()
  const addDocument = useAddApplicantDocument()
  const enrolApplicant = useEnrolApplicant()

  const [activeTab, setActiveTab] = useState<TabKey>('application')
  const [decisionNotes, setDecisionNotes] = useState('')
  const [docType, setDocType] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [enrolOpen, setEnrolOpen] = useState(false)
  const [mopseNumber, setMopseNumber] = useState('')
  const [pendingCategory, setPendingCategory] = useState('')

  if (isLoading) {
    return (
      <>
        <BursarHeader />
        <Main><p className='text-sm text-muted-foreground'>Loading…</p></Main>
      </>
    )
  }

  if (error || !applicant) {
    return (
      <>
        <BursarHeader />
        <Main>
          <BackLink to='/bursar/admissions/applicants' label='Back to applicants' />
          <p className='mt-4 text-sm text-destructive'>Couldn't load this applicant. They may not exist, or the server is unreachable.</p>
        </Main>
      </>
    )
  }

  const isEnrolled = !!applicant.enrolled_student

  async function setStatus(status: FrappeApplicantDetail['status']) {
    if (status === 'Declined' && !decisionNotes.trim()) {
      toast.error('Record a reason before declining an applicant.')
      return
    }
    try {
      await updateApplicant.mutateAsync({ name: applicant!.name, input: { status, decision_notes: decisionNotes || applicant!.decision_notes } })
      toast.success(`Marked ${status}`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this application.')
    }
  }

  async function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !docType.trim()) {
      toast.error('Enter a document type before choosing a file.')
      return
    }
    setUploadingDoc(true)
    try {
      await addDocument.mutateAsync({ applicant: applicant!.name, documents: applicant!.documents, documentType: docType.trim(), file })
      toast.success('Document added')
      setDocType('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not upload this document.')
    } finally {
      setUploadingDoc(false)
    }
  }

  async function saveCategory() {
    if (!pendingCategory) return
    try {
      await updateApplicant.mutateAsync({ name: applicant!.name, input: { beneficiary_category: pendingCategory } })
      toast.success('Beneficiary category set')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not set the beneficiary category.')
    }
  }

  async function handleEnrol() {
    try {
      const studentId = await enrolApplicant.mutateAsync({ name: applicant!.name, mopseAdmissionNumber: mopseNumber || undefined })
      toast.success(`Enrolled as ${studentId}`)
      setEnrolOpen(false)
      setMopseNumber('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not enrol this applicant.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <BackLink to='/bursar/admissions/applicants' label='Back to applicants' />

        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <GraduationCap className='h-6 w-6' />
            </div>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>{applicant.full_legal_name}</h1>
              <p className='text-sm text-muted-foreground'>
                {applicant.name} • {applicant.entry_grade ?? 'No grade set'} • {applicant.academic_year}
              </p>
            </div>
          </div>
          <StatusBadge tone={isEnrolled ? 'good' : applicant.status === 'Declined' ? 'bad' : applicant.status === 'Accepted' ? 'good' : 'warning'}>
            {isEnrolled ? 'Enrolled' : applicant.status}
          </StatusBadge>
        </div>

        <div className='mb-6 flex flex-wrap items-center gap-1 border-b'>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'application' && (
          <Card>
            <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Application Details</CardTitle></CardHeader>
            <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
              <Field label='Date of birth' value={applicant.date_of_birth} />
              <Field label='Gender' value={applicant.gender} />
              <Field label='Home address' value={applicant.home_address} />
              <Field label='Academic year' value={applicant.academic_year} />
              <Field label='Intended term' value={applicant.intended_term} />
              <Field label='Entry grade/form' value={applicant.entry_grade} />
              <Field label='Attendance type' value={applicant.attendance_type} />
              <Field label='Beneficiary category' value={applicant.beneficiary_category} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'academic' && (
          <Card>
            <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Previous Academic Record</CardTitle></CardHeader>
            <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
              <Field label='Previous school' value={applicant.previous_school_name} />
              <Field label='Previous school EMIS #' value={applicant.previous_school_emis_number} />
              <Field label='Last grade completed' value={applicant.last_grade_completed} />
              <Field label='National exam type' value={applicant.national_exam_type} />
              <Field label='National exam results' value={applicant.national_exam_results} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'guardian' && (
          <Card>
            <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Guardian Contact</CardTitle></CardHeader>
            <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
              <Field label='Name' value={applicant.guardian_name} />
              <Field label='Relationship' value={applicant.guardian_relationship} />
              <Field label='Phone' value={applicant.guardian_phone} />
              <Field label='Email' value={applicant.guardian_email} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader className='border-b py-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-sm'>Application Documents</CardTitle>
                <div className='flex items-center gap-2'>
                  <Input className='h-8 w-40 text-xs' placeholder='Document type' value={docType} onChange={(e) => setDocType(e.target.value)} />
                  <input ref={fileInputRef} type='file' className='hidden' onChange={handleDocFile} />
                  <Button size='sm' variant='outline' onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc}>
                    <Upload className='h-3.5 w-3.5' />
                    {uploadingDoc ? 'Uploading…' : 'Add document'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className='pt-0'>
              {applicant.documents.length > 0 ? (
                <div className='divide-y'>
                  {applicant.documents.map((d) => (
                    <div key={d.name} className='flex items-center justify-between py-3'>
                      <p className='text-sm font-medium'>{d.document_type}</p>
                      <a href={d.attachment} target='_blank' rel='noreferrer' className='text-xs text-primary hover:underline'>View</a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='py-4 text-sm text-muted-foreground'>No documents on file</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'decision' && (
          <div className='grid gap-4'>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Application Fee</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Receipt number' value={applicant.application_fee_receipt_number} />
                <div>
                  <p className='text-xs text-muted-foreground'>Amount</p>
                  <p className='text-sm'>{applicant.application_fee_amount ? <Money usd={applicant.application_fee_amount} /> : '—'}</p>
                </div>
                <Field label='Posted to ledger' value={applicant.application_fee_journal_entry ? 'Yes' : 'Not yet'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='border-b py-3'><CardTitle className='text-sm'>Decision</CardTitle></CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3'>
                <Field label='Current status' value={isEnrolled ? 'Enrolled' : applicant.status} />
                <Field label='Notes' value={applicant.decision_notes} />
              </CardContent>
            </Card>

            {!isEnrolled && (
              <div className='space-y-2'>
                {applicant.status !== 'Declined' && (
                  <div className='grid gap-2'>
                    <Label htmlFor='decision-notes'>Decision notes (required to decline)</Label>
                    <Textarea id='decision-notes' rows={2} value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} />
                  </div>
                )}
                <div className='flex flex-wrap items-center gap-2'>
                  {applicant.status === 'Under Review' && (
                    <Button variant='outline' onClick={() => setStatus('Waitlisted')} disabled={updateApplicant.isPending}>Waitlist</Button>
                  )}
                  {applicant.status !== 'Accepted' && (
                    <Button onClick={() => setStatus('Accepted')} disabled={updateApplicant.isPending}>Accept application</Button>
                  )}
                  {applicant.status !== 'Declined' && (
                    <Button variant='outline' onClick={() => setStatus('Declined')} disabled={updateApplicant.isPending}>Decline application</Button>
                  )}
                  {applicant.status === 'Accepted' && (
                    <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
                      <DialogTrigger asChild>
                        <Button><GraduationCap className='h-4 w-4' />Enrol as student</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enrol {applicant.full_legal_name}</DialogTitle>
                          <DialogDescription>Creates a real Student and Parent Guardian record.</DialogDescription>
                        </DialogHeader>
                        {!applicant.beneficiary_category && (
                          <div className='space-y-2 rounded-md border border-destructive/50 p-3'>
                            <p className='text-sm text-destructive'>A Beneficiary Category is required before enrolling.</p>
                            <div className='flex gap-2'>
                              <Select value={pendingCategory} onValueChange={setPendingCategory}>
                                <SelectTrigger className='h-8 text-xs'><SelectValue placeholder='Select…' /></SelectTrigger>
                                <SelectContent>{(beneficiaryCategories ?? []).map((c) => <SelectItem key={c.name} value={c.name}>{c.category_name}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button size='sm' onClick={saveCategory} disabled={!pendingCategory || updateApplicant.isPending}>Set</Button>
                            </div>
                          </div>
                        )}
                        <div className='grid gap-2 py-2'>
                          <Label htmlFor='mopse'>MoPSE admission number (optional)</Label>
                          <Input id='mopse' value={mopseNumber} onChange={(e) => setMopseNumber(e.target.value)} />
                        </div>
                        <DialogFooter>
                          <Button onClick={handleEnrol} disabled={enrolApplicant.isPending || !applicant.beneficiary_category}>
                            {enrolApplicant.isPending ? 'Enrolling…' : 'Enrol'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            )}
            {isEnrolled && <StatusBadge tone='good'>Enrolled as {applicant.enrolled_student} on {applicant.enrolled_on}</StatusBadge>}
          </div>
        )}
      </Main>
    </>
  )
}
