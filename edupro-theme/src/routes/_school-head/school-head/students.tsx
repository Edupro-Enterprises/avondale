import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { UserSearch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useStudents, useBeneficiaryCategories, type FrappeStudent } from '@/lib/frappe/students'
import { useInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_school-head/school-head/students')({
  component: StudentsPage,
})

type StudentRow = FrappeStudent & { displayName: string; feeStatus: FeeStatus; balanceUSD: number }

function StudentsPage() {
  const { data: students, isLoading: studentsLoading, error } = useStudents()
  const { data: invoices, isLoading: invoicesLoading } = useInvoices()
  const { data: categories } = useBeneficiaryCategories()
  const isLoading = studentsLoading || invoicesLoading

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'category', label: 'Beneficiary Category', options: (categories ?? []).map((c) => c.category_name) },
      { key: 'status', label: 'Fee Status', options: ['Pending', 'Partial', 'Overdue', 'Paid'] },
    ],
    [categories]
  )
  const filters = useFilters('school-head-students', filterGroups)

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

  const filtered = useMemo(() => {
    const { search, values } = filters
    return rows.filter(
      (s) =>
        (s.displayName.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())) &&
        (!values.category || s.beneficiary_category === values.category) &&
        (!values.status || s.feeStatus === values.status.toLowerCase())
    )
  }, [rows, filters])

  const columns: DataListColumn<StudentRow>[] = [
    {
      id: 'name',
      header: 'Student',
      sortable: true,
      sortValue: (s) => s.displayName,
      className: 'min-w-40',
      cell: (s) => (
        <div className='flex flex-col'>
          <span className='truncate'>{s.displayName}</span>
          <span className='truncate text-xs text-muted-foreground'>{s.name} · {s.grade ?? '—'}</span>
        </div>
      ),
    },
    { id: 'category', header: 'Category', sortable: true, sortValue: (s) => s.beneficiary_category, cell: (s) => s.beneficiary_category },
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
  ]

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Students</h1>
          <p className='text-sm text-muted-foreground'>Read-only registry oversight.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load students from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Roster</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(s) => s.name}
              isLoading={isLoading}
              densityStorageKey='school-head-students'
              defaultSort={[{ id: 'name', desc: false }]}
              emptyState={{
                icon: UserSearch,
                title: 'No students found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Students will appear here once enrolled.',
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
