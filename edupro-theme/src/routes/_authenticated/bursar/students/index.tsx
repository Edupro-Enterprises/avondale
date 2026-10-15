import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  GraduationCap,
  MoreVertical,
  Plus,
  Printer,
  Trash2,
  Upload,
  UserSearch,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useStudents, useBeneficiaryCategories, useCreateStudent, useDeleteStudentForCorrection, type FrappeStudent, type NewStudentInput } from '@/lib/frappe/students'
import { useClassStreams } from '@/lib/frappe/class-streams'
import { ImportDialog } from '@/components/import-dialog'
import { useInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'
import { Money } from '@/components/money'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { ReportActions } from '@/components/report-actions'
import { StudentFormDialog } from '@/components/student-form-dialog'
import { viewFinancialReportPdf, downloadFinancialReportPdf } from '@/lib/print-reports'
import { FrappeApiError } from '@/lib/frappe/client'
import { formatStudentName } from '@/lib/utils'

type StudentRow = FrappeStudent & {
  displayName: string
  feeStatus: FeeStatus
  balanceUSD: number
}

const ENROLLMENT_STATUSES = ['Active', 'Suspended', 'Withdrawn', 'Transferred Out', 'Deceased', 'Graduated']

function getStatusIcon(status: FeeStatus) {
  switch (status) {
    case 'paid':
      return <CheckCircle2 className='h-4 w-4 text-emerald-600' />
    case 'partial':
      return <Clock className='h-4 w-4 text-amber-600' />
    case 'overdue':
      return <AlertCircle className='h-4 w-4 text-red-600' />
    case 'pending':
      return <CreditCard className='h-4 w-4 text-slate-400' />
    default:
      return null
  }
}

function StudentsPage() {
  const { data: students, isLoading: studentsLoading, error } = useStudents()
  const { data: invoices, isLoading: invoicesLoading } = useInvoices()
  const { data: categories } = useBeneficiaryCategories()
  const { data: classStreams } = useClassStreams()

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      {
        key: 'category',
        label: 'Beneficiary Category',
        options: (categories ?? []).map((c) => c.category_name),
      },
      { key: 'status', label: 'Fee Status', options: ['Pending', 'Partial', 'Overdue', 'Paid'] },
      { key: 'boarding', label: 'Boarding Status', options: ['Boarder', 'Day'] },
      // Sourced from the configured Class Stream list, not raw student.grade
      // values -- a grade with no real stream (e.g. a generic, unstreamed
      // bucket some students still sit on) has no Class Stream record and
      // so doesn't appear here, even if students with that grade text exist.
      { key: 'grade', label: 'Grade', options: (classStreams ?? []).map((c) => c.stream_name).sort() },
      { key: 'year', label: 'Academic Year', options: [...new Set((students ?? []).map((s) => s.academic_year))].sort().reverse() },
      { key: 'term', label: 'Term', options: [...new Set((students ?? []).map((s) => s.current_term).filter((t): t is string => !!t))].sort() },
      { key: 'enrollmentStatus', label: 'Enrollment Status', options: ENROLLMENT_STATUSES },
    ],
    [categories, students, classStreams]
  )

  const filters = useFilters('students', filterGroups)
  const { enrollmentStatus: enrollmentStatusParam } = Route.useSearch()

  // A dashboard link (e.g. "Transferred" count) can pre-select this filter
  // via the URL -- applied once on arrival, same as a manual filter pick,
  // so it still composes with whatever else the Bursar filters by next.
  useEffect(() => {
    if (enrollmentStatusParam) filters.setValue('enrollmentStatus', enrollmentStatusParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentStatusParam])
  const isLoading = studentsLoading || invoicesLoading
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const createStudent = useCreateStudent()
  const selectedGrade = filters.values.grade

  const [deleteTargets, setDeleteTargets] = useState<StudentRow[]>([])
  const [deleteReason, setDeleteReason] = useState('')
  const deleteStudent = useDeleteStudentForCorrection()

  function closeDeleteDialog() {
    setDeleteTargets([])
    setDeleteReason('')
  }

  async function handleConfirmDelete() {
    const targets = deleteTargets
    const reason = deleteReason.trim()
    let succeeded = 0
    const failures: string[] = []
    for (const s of targets) {
      try {
        await deleteStudent.mutateAsync({ student: s.name, justification: reason })
        succeeded++
      } catch (err) {
        failures.push(`${s.displayName}: ${err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not delete this record.'}`)
      }
    }
    closeDeleteDialog()
    if (succeeded > 0) toast.success(`Deleted ${succeeded} student record${succeeded === 1 ? '' : 's'}.`)
    for (const f of failures) toast.error(f)
  }

  async function handleViewClassList() {
    if (!selectedGrade) {
      toast.error('Pick a specific class from the Grade filter first.')
      return
    }
    try {
      await viewFinancialReportPdf('class-list', { grade: selectedGrade })
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not generate the class list.')
    }
  }

  async function handleDownloadClassList() {
    if (!selectedGrade) {
      toast.error('Pick a specific class from the Grade filter first.')
      return
    }
    try {
      await downloadFinancialReportPdf('class-list', { grade: selectedGrade }, `${selectedGrade}-class-list.pdf`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not generate the class list.')
    }
  }

  const rows: StudentRow[] = useMemo(() => {
    if (!students) return []
    const invoicesByStudent = new Map<string, typeof invoices>()
    for (const inv of invoices ?? []) {
      const list = invoicesByStudent.get(inv.student) ?? []
      list.push(inv)
      invoicesByStudent.set(inv.student, list)
    }
    return students.map((s) => {
      const { status, balanceUSD } = computeFeeStatus(invoicesByStudent.get(s.name) ?? [])
      return { ...s, displayName: formatStudentName(s.first_name, s.last_name), feeStatus: status, balanceUSD }
    })
  }, [students, invoices])

  const filteredStudents = useMemo(() => {
    const { search, values } = filters
    return rows.filter((student) => {
      const matchesSearch =
        student.displayName.toLowerCase().includes(search.toLowerCase()) ||
        student.name.toLowerCase().includes(search.toLowerCase())

      const matchesCategory = !values.category || student.beneficiary_category === values.category
      const matchesStatus = !values.status || student.feeStatus === values.status.toLowerCase()
      const matchesBoarding =
        !values.boarding || (values.boarding === 'Boarder' ? student.is_boarder === 1 : student.is_boarder !== 1)
      const matchesGrade = !values.grade || student.grade === values.grade
      const matchesYear = !values.year || student.academic_year === values.year
      const matchesTerm = !values.term || student.current_term === values.term
      const matchesEnrollmentStatus = !values.enrollmentStatus || student.status === values.enrollmentStatus

      return matchesSearch && matchesCategory && matchesStatus && matchesBoarding && matchesGrade && matchesYear && matchesTerm && matchesEnrollmentStatus
    })
  }, [rows, filters])

  const statusCounts = useMemo(() => {
    return {
      pending: rows.filter((s) => s.feeStatus === 'pending').length,
      partial: rows.filter((s) => s.feeStatus === 'partial').length,
      overdue: rows.filter((s) => s.feeStatus === 'overdue').length,
      paid: rows.filter((s) => s.feeStatus === 'paid').length,
    }
  }, [rows])

  const reportRows = useMemo(
    () => filteredStudents.map((s) => [s.name, s.displayName, s.grade ?? '', s.beneficiary_category, s.is_boarder === 1 ? 'Boarder' : 'Day', s.balanceUSD, s.feeStatus]),
    [filteredStudents]
  )

  const columns: DataListColumn<StudentRow>[] = [
    {
      id: 'name',
      header: 'Student',
      sortable: true,
      sortValue: (s) => s.displayName,
      className: 'min-w-40',
      cell: (s) => (
        <Link
          to='/bursar/students/$studentId'
          params={{ studentId: s.name }}
          search={{ tab: undefined }}
          className='flex items-center gap-2 hover:underline'
        >
          <GraduationCap className='h-3.5 w-3.5 shrink-0 text-primary' />
          {s.displayName}
          {getStatusIcon(s.feeStatus)}
        </Link>
      ),
    },
    { id: 'id', header: 'ID', sortable: true, sortValue: (s) => s.name, cell: (s) => s.name },
    { id: 'form', header: 'Form', sortable: true, sortValue: (s) => s.grade ?? '', cell: (s) => s.grade ?? '—' },
    { id: 'enrollment', header: 'Enrollment', sortable: true, sortValue: (s) => s.status, cell: (s) => s.status },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      sortValue: (s) => s.beneficiary_category,
      cell: (s) => s.beneficiary_category,
    },
    {
      id: 'balance',
      header: 'Balance',
      sortable: true,
      sortValue: (s) => s.balanceUSD,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (s) => (s.balanceUSD > 0 ? <Money usd={s.balanceUSD} compact /> : 'Settled'),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (s) => s.feeStatus,
      cell: (s) => s.feeStatus.charAt(0).toUpperCase() + s.feeStatus.slice(1),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-8',
      cell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='h-7! w-7!' aria-label={`More actions for ${s.displayName}`} onClick={(e) => e.stopPropagation()}>
              <MoreVertical className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem asChild>
              <Link to='/bursar/students/$studentId' params={{ studentId: s.name }} search={{ tab: undefined }}>
                <Eye className='h-4 w-4 mr-2' />
                View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/bursar/students/$studentId' params={{ studentId: s.name }} search={{ tab: 'financial' }}>
                <CreditCard className='h-4 w-4 mr-2' />
                Payment history
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast.success(`Statement sent for ${s.displayName}`)}>
              <Download className='h-4 w-4 mr-2' />
              Send statement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <BursarHeader />

      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-2 text-sm font-medium text-primary'>Enrollment</p>
            <h1 className='text-3xl font-bold tracking-tight'>Students</h1>
          </div>
          <div className='flex items-center gap-2'>
            <ReportActions
              filename='students-roster'
              title='Students Roster'
              meta={`Generated ${new Date().toISOString().slice(0, 10)} · ${filteredStudents.length} of ${rows.length} students`}
              header={['Student ID', 'Name', 'Grade', 'Beneficiary Category', 'Boarding', 'Balance (USD)', 'Fee Status']}
              rows={reportRows}
            />
            <Button variant='outline' onClick={() => setImportOpen(true)}>
              <Upload className='h-4 w-4' />
              Import
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className='h-4 w-4' />
              Add student
            </Button>
          </div>
        </div>

        <StudentFormDialog key={String(addOpen)} open={addOpen} onOpenChange={setAddOpen} />

        <ImportDialog<NewStudentInput>
          open={importOpen}
          onOpenChange={setImportOpen}
          title='Import students'
          description='First Name, Last Name, Admission Date, Academic Year, and Beneficiary Category are required -- everything else is optional.'
          templateFilename='students-import-template.xlsx'
          templateHeaders={['First Name', 'Last Name', 'Date of Birth', 'Gender', 'Admission Date', 'Academic Year', 'Beneficiary Category', 'Class/Stream', 'Status']}
          templateSample={['John', 'Moyo', '2015-03-12', 'Male', '2026-01-13', '2026', 'Parent-Funded', 'Grade 1 L', 'Active']}
          parseRow={(row) => {
            if (!row['First Name']) return { error: 'Missing First Name' }
            if (!row['Last Name']) return { error: 'Missing Last Name' }
            if (!row['Admission Date']) return { error: 'Missing Admission Date' }
            if (!row['Academic Year']) return { error: 'Missing Academic Year' }
            if (!row['Beneficiary Category']) return { error: 'Missing Beneficiary Category' }
            return {
              value: {
                first_name: row['First Name'],
                last_name: row['Last Name'],
                date_of_birth: row['Date of Birth'] || undefined,
                gender: row['Gender'] || undefined,
                admission_date: row['Admission Date'],
                academic_year: row['Academic Year'],
                beneficiary_category: row['Beneficiary Category'],
                grade: row['Class/Stream'] || undefined,
                status: row['Status'] || undefined,
              },
            }
          }}
          rowLabel={(r) => formatStudentName(r.first_name, r.last_name)}
          commitRow={async (r) => { await createStudent.mutateAsync(r) }}
        />

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load students from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <div className='mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <StatusCard
            title='All students'
            count={rows.length}
            icon={<Users className='h-4 w-4' />}
          />
          <StatusCard
            title='Fees paid'
            count={statusCounts.paid}
            icon={<CheckCircle2 className='h-4 w-4 text-emerald-600' />}
          />
          <StatusCard
            title='Partial'
            count={statusCounts.partial}
            icon={<Clock className='h-4 w-4 text-amber-600' />}
          />
          <StatusCard
            title='Overdue'
            count={statusCounts.overdue}
            icon={<AlertCircle className='h-4 w-4 text-red-600' />}
          />
        </div>

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Roster</CardTitle>
                <CardDescription>
                  {filteredStudents.length} of {rows.length} students
                </CardDescription>
              </div>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search by name or ID...' />
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={!selectedGrade}
                    title={selectedGrade ? `Print the class list for ${selectedGrade}` : 'Pick a class from the Grade filter first'}
                    onClick={handleViewClassList}
                  >
                    <Printer className='h-4 w-4' />
                    Print class list
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={!selectedGrade}
                    title={selectedGrade ? `Download the class list for ${selectedGrade}` : 'Pick a class from the Grade filter first'}
                    onClick={handleDownloadClassList}
                  >
                    <Download className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filteredStudents}
              columns={columns}
              getRowId={(s) => s.name}
              isLoading={isLoading}
              densityStorageKey='students'
              defaultSort={[{ id: 'name', desc: false }]}
              selectable
              bulkActions={[
                {
                  label: 'Delete',
                  icon: Trash2,
                  variant: 'destructive',
                  onAction: (selected) => setDeleteTargets(selected),
                },
              ]}
              emptyState={{
                icon: UserSearch,
                title: 'No students found',
                description:
                  filters.activeCount > 0
                    ? 'Try adjusting your search or filters.'
                    : 'Students will appear here once enrolled.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={deleteTargets.length > 0} onOpenChange={(o) => { if (!o) closeDeleteDialog() }}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>
                Delete {deleteTargets.length === 1 ? deleteTargets[0]?.displayName : `${deleteTargets.length} students`}?
              </DialogTitle>
              <DialogDescription>
                This permanently removes the record and cannot be undone. Any invoice on file is cancelled
                automatically. Blocked only if the student has an actual recorded payment -- use Status
                (Suspended, Withdrawn, Transferred Out, Deceased, Graduated) for that case instead.
              </DialogDescription>
            </DialogHeader>
            <div className='max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm'>
              {deleteTargets.map((s) => (
                <div key={s.name} className='flex items-center justify-between gap-2'>
                  <span>{s.displayName}</span>
                  <span className='text-muted-foreground'>{s.name}</span>
                </div>
              ))}
            </div>
            <Textarea
              rows={3}
              placeholder='Reason for deleting (required)'
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
            <DialogFooter>
              <Button variant='outline' onClick={closeDeleteDialog} disabled={deleteStudent.isPending}>
                Cancel
              </Button>
              <Button
                variant='destructive'
                disabled={!deleteReason.trim() || deleteStudent.isPending}
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}

function StatusCard({
  title,
  count,
  icon,
}: {
  title: string
  count: number
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {title}
        </CardTitle>
        <div className='rounded-full bg-primary/10 p-2 text-primary'>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{count}</div>
      </CardContent>
    </Card>
  )
}

export const Route = createFileRoute('/_authenticated/bursar/students/')({
  validateSearch: z.object({ enrollmentStatus: z.string().optional() }),
  component: StudentsPage,
})
