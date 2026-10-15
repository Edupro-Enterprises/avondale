import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { UserPlus, UserSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAcademicYears } from '@/lib/frappe/academic-years'
import { useTerms } from '@/lib/frappe/terms'
import { useApplicants, useCreateApplicant, type FrappeApplicant, type NewApplicantInput } from '@/lib/frappe/applicants'

export const Route = createFileRoute('/_authenticated/bursar/admissions/applicants/')({
  component: ApplicantsPage,
})

function displayStatus(a: FrappeApplicant): { label: string; tone: StatusTone } {
  if (a.enrolled_student) return { label: 'Enrolled', tone: 'good' }
  const tone: Record<FrappeApplicant['status'], StatusTone> = {
    'Under Review': 'info',
    Waitlisted: 'warning',
    Accepted: 'good',
    Declined: 'bad',
  }
  return { label: a.status, tone: tone[a.status] }
}

function StatusCard({ title, count }: { title: string; count: number }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{count}</div>
      </CardContent>
    </Card>
  )
}

const defaultForm: NewApplicantInput = {
  full_legal_name: '',
  date_of_birth: '',
  academic_year: '',
  attendance_type: 'Day Scholar',
  guardian_name: '',
  guardian_phone: '',
}

function ApplicantsPage() {
  const navigate = useNavigate()
  const { data: applicants, isLoading, error } = useApplicants()
  const { data: academicYears } = useAcademicYears()
  const { data: terms } = useTerms()
  const createApplicant = useCreateApplicant()

  const rows = useMemo(() => applicants ?? [], [applicants])

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: ['Under Review', 'Waitlisted', 'Accepted', 'Declined', 'Enrolled'] },
      { key: 'grade', label: 'Entry Grade', options: [...new Set(rows.map((a) => a.entry_grade).filter((g): g is string => !!g))].sort() },
      { key: 'year', label: 'Academic Year', options: [...new Set(rows.map((a) => a.academic_year))].sort().reverse() },
      { key: 'term', label: 'Intended Term', options: [...new Set(rows.map((a) => a.intended_term).filter((t): t is string => !!t))].sort() },
    ],
    [rows]
  )
  const filters = useFilters('applicants', filterGroups)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<NewApplicantInput>(defaultForm)

  const termsForYear = useMemo(() => (terms ?? []).filter((t) => t.academic_year === form.academic_year), [terms, form.academic_year])

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((a) => {
      const matchesSearch = a.full_legal_name.toLowerCase().includes(search)
      const matchesStatus = !filters.values.status || displayStatus(a).label === filters.values.status
      const matchesGrade = !filters.values.grade || a.entry_grade === filters.values.grade
      const matchesYear = !filters.values.year || a.academic_year === filters.values.year
      const matchesTerm = !filters.values.term || a.intended_term === filters.values.term
      return matchesSearch && matchesStatus && matchesGrade && matchesYear && matchesTerm
    })
  }, [rows, filters.search, filters.values])

  const underReviewCount = rows.filter((a) => a.status === 'Under Review' || a.status === 'Waitlisted').length
  const acceptedCount = rows.filter((a) => a.status === 'Accepted' && !a.enrolled_student).length
  const enrolledCount = rows.filter((a) => a.enrolled_student).length

  async function submit() {
    if (!form.full_legal_name.trim() || !form.date_of_birth || !form.academic_year || !form.guardian_name.trim() || !form.guardian_phone.trim()) {
      toast.error('Full name, date of birth, academic year, and guardian name and phone are all required.')
      return
    }
    try {
      const name = await createApplicant.mutateAsync(form)
      toast.success(`${name} recorded`)
      setAddOpen(false)
      setForm(defaultForm)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this application.')
    }
  }

  const columns: DataListColumn<FrappeApplicant>[] = [
    { id: 'name', header: 'Applicant', sortable: true, sortValue: (a) => a.full_legal_name, className: 'min-w-40', cell: (a) => a.full_legal_name },
    { id: 'number', header: 'Application #', sortable: true, sortValue: (a) => a.name, cell: (a) => a.name },
    { id: 'grade', header: 'Entry Grade', sortable: true, sortValue: (a) => a.entry_grade ?? '', cell: (a) => a.entry_grade ?? '—' },
    { id: 'year', header: 'Academic Year', sortable: true, sortValue: (a) => a.academic_year, cell: (a) => a.academic_year },
    { id: 'guardian', header: 'Guardian', sortable: true, sortValue: (a) => a.guardian_name, cell: (a) => a.guardian_name },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (a) => displayStatus(a).label,
      cell: (a) => {
        const { label, tone } = displayStatus(a)
        return <StatusBadge tone={tone}>{label}</StatusBadge>
      },
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Admissions</p>
            <h1 className='text-3xl font-bold tracking-tight'>Applicants</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (o) setForm(defaultForm) }}>
            <DialogTrigger asChild>
              <Button><UserPlus className='h-4 w-4' />New application</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New application</DialogTitle>
                <DialogDescription>Captures the essentials — full details are completed on the applicant's record.</DialogDescription>
              </DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Full legal name' className='col-span-2' required>
                  <Input className={compactControlClass} value={form.full_legal_name} onChange={(e) => setForm((f) => ({ ...f, full_legal_name: e.target.value }))} placeholder='Rufaro Chiweshe' />
                </CompactField>
                <CompactField label='Date of birth' required>
                  <Input type='date' className={compactControlClass} value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                </CompactField>
                <CompactField label='Gender'>
                  <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v as NewApplicantInput['gender'] }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent><SelectItem value='Female'>Female</SelectItem><SelectItem value='Male'>Male</SelectItem></SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Academic year' required>
                  <Select value={form.academic_year} onValueChange={(v) => setForm((f) => ({ ...f, academic_year: v, intended_term: undefined }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{(academicYears ?? []).map((y) => <SelectItem key={y.name} value={y.name}>{y.academic_year_name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Intended term'>
                  <Select value={form.intended_term} onValueChange={(v) => setForm((f) => ({ ...f, intended_term: v }))} disabled={!form.academic_year}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{termsForYear.map((t) => <SelectItem key={t.name} value={t.name}>{t.term_name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Entry grade/form'>
                  <Input className={compactControlClass} value={form.entry_grade ?? ''} onChange={(e) => setForm((f) => ({ ...f, entry_grade: e.target.value }))} placeholder='Form 1' />
                </CompactField>
                <CompactField label='Attendance type'>
                  <Select value={form.attendance_type} onValueChange={(v) => setForm((f) => ({ ...f, attendance_type: v as NewApplicantInput['attendance_type'] }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value='Day Scholar'>Day Scholar</SelectItem><SelectItem value='Boarder'>Boarder</SelectItem></SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Guardian name' className='col-span-2' required>
                  <Input className={compactControlClass} value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
                </CompactField>
                <CompactField label='Guardian phone' required>
                  <Input className={compactControlClass} value={form.guardian_phone} onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))} placeholder='+263 77 …' />
                </CompactField>
                <CompactField label='Guardian email'>
                  <Input type='email' className={compactControlClass} value={form.guardian_email ?? ''} onChange={(e) => setForm((f) => ({ ...f, guardian_email: e.target.value }))} />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createApplicant.isPending}>{createApplicant.isPending ? 'Recording…' : 'Record application'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load applicants from the server. Try refreshing the page.</CardContent></Card>
        )}

        <div className='mb-6 grid gap-4 sm:grid-cols-3'>
          <StatusCard title='Under review / waitlisted' count={underReviewCount} />
          <StatusCard title='Accepted, not yet enrolled' count={acceptedCount} />
          <StatusCard title='Enrolled' count={enrolledCount} />
        </div>

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All applicants</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search by name…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(a) => a.name}
              isLoading={isLoading}
              onRowClick={(a) => navigate({ to: '/bursar/admissions/applicants/$applicantId', params: { applicantId: a.name } })}
              densityStorageKey='applicants'
              emptyState={{
                icon: UserSearch,
                title: 'No applicants found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Applicants will appear here once submitted.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
