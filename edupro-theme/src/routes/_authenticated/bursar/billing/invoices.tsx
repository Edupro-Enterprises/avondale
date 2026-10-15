import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileSearch, ReceiptText, Send } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { ReportActions } from '@/components/report-actions'
import { useInvoices, useInvoice, type FrappeInvoice } from '@/lib/frappe/invoices'
import { useStudents } from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/bursar/billing/invoices')({
  component: InvoicesPage,
})

const today = () => new Date().toISOString().slice(0, 10)

function deriveStatus(inv: FrappeInvoice): { label: string; tone: StatusTone } {
  if (inv.status === 'Cancelled') return { label: 'Cancelled', tone: 'neutral' }
  if (inv.status === 'Consolidated') return { label: 'Consolidated', tone: 'neutral' }
  if (inv.status === 'Paid') return { label: 'Paid', tone: 'good' }
  const overdue = inv.outstanding_amount > 0 && !!inv.due_date && inv.due_date < today()
  if (overdue) return { label: 'Overdue', tone: 'bad' }
  if (inv.status === 'Partly Paid') return { label: 'Partial', tone: 'warning' }
  return { label: 'Pending', tone: 'neutral' }
}

function InvoicesPage() {
  const { data: invoices, isLoading, error } = useInvoices()
  const { data: students } = useStudents()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useInvoice(selectedName ?? undefined)

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) map.set(s.name, formatStudentName(s.first_name, s.last_name))
    return map
  }, [students])
  const studentGrades = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) if (s.grade) map.set(s.name, s.grade)
    return map
  }, [students])

  const rows = useMemo(() => invoices ?? [], [invoices])

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: ['Pending', 'Partial', 'Overdue', 'Paid', 'Cancelled', 'Consolidated'] },
      { key: 'grade', label: 'Grade', options: [...new Set(rows.map((i) => studentGrades.get(i.student)).filter((g): g is string => !!g))].sort() },
      { key: 'year', label: 'Academic Year', options: [...new Set(rows.map((i) => i.academic_year))].sort().reverse() },
      { key: 'term', label: 'Term', options: [...new Set(rows.map((i) => i.term))].sort() },
    ],
    [rows, studentGrades]
  )
  const filters = useFilters('invoices', filterGroups)

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((inv) => {
      const studentName = studentNames.get(inv.student) ?? inv.student
      const matchesSearch = studentName.toLowerCase().includes(search) || inv.name.toLowerCase().includes(search)
      const matchesStatus = !filters.values.status || deriveStatus(inv).label === filters.values.status
      const matchesGrade = !filters.values.grade || studentGrades.get(inv.student) === filters.values.grade
      const matchesYear = !filters.values.year || inv.academic_year === filters.values.year
      const matchesTerm = !filters.values.term || inv.term === filters.values.term
      return matchesSearch && matchesStatus && matchesGrade && matchesYear && matchesTerm
    })
  }, [rows, studentNames, studentGrades, filters.search, filters.values])

  const reportRows = useMemo(
    () => filtered.map((i) => [i.name, studentNames.get(i.student) ?? i.student, i.academic_year, i.term, i.due_date ?? '', i.outstanding_amount, deriveStatus(i).label]),
    [filtered, studentNames]
  )

  const columns: DataListColumn<FrappeInvoice>[] = [
    {
      id: 'student',
      header: 'Student',
      sortable: true,
      sortValue: (i) => studentNames.get(i.student) ?? i.student,
      className: 'min-w-32',
      cell: (i) => studentNames.get(i.student) ?? i.student,
    },
    { id: 'id', header: 'Invoice ID', sortable: true, sortValue: (i) => i.name, cell: (i) => i.name },
    { id: 'due', header: 'Due', sortable: true, sortValue: (i) => i.due_date ?? '', cell: (i) => i.due_date ?? '—' },
    {
      id: 'outstanding',
      header: 'Outstanding',
      sortable: true,
      sortValue: (i) => i.outstanding_amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (i) =>
        i.status === 'Consolidated' ? (
          <span className='text-muted-foreground italic'>Carried forward</span>
        ) : (
          <Money usd={i.outstanding_amount} />
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (i) => deriveStatus(i).label,
      cell: (i) => {
        const { label, tone } = deriveStatus(i)
        return <StatusBadge tone={tone}>{label}</StatusBadge>
      },
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <ReceiptText className='h-5 w-5' />
            </div>
            <div>
              <p className='mb-1 text-sm font-medium text-primary'>Billing</p>
              <h1 className='text-3xl font-bold tracking-tight'>Invoices</h1>
            </div>
          </div>
          <ReportActions
            filename='invoices'
            title='Invoices'
            meta={`Generated ${today()} · ${filtered.length} of ${rows.length} invoices (outstanding amounts in USD)`}
            header={['Invoice ID', 'Student', 'Academic Year', 'Term', 'Due Date', 'Outstanding (USD)', 'Status']}
            rows={reportRows}
          />
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load invoices from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All invoices</CardTitle>
                <CardDescription>
                  {filtered.length} of {rows.length}
                </CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search by student or ID…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(i) => i.name}
              isLoading={isLoading}
              onRowClick={(inv) => setSelectedName(inv.name)}
              selectable
              densityStorageKey='invoices'
              bulkActions={[
                {
                  label: 'Send reminder',
                  icon: Send,
                  onAction: (rows) => toast.success(`Reminder sent for ${rows.length} invoice${rows.length === 1 ? '' : 's'}`),
                },
              ]}
              emptyState={{
                icon: FileSearch,
                title: 'No invoices found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Invoices will appear here once issued.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Student</span><span>{studentNames.get(selected.student) ?? selected.student}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Term</span><span>{selected.term}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Fee structure</span><span>{selected.fee_structure}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Issued</span><span>{selected.posting_date} by {selected.owner}</span></div>
                <div className='divide-y rounded-md border'>
                  {selected.items.map((li) => (
                    <div key={li.name} className='flex items-center justify-between px-3 py-2'>
                      <span>
                        {li.description || li.fee_item}
                        {li.is_brought_forward === 1 && <span className='ml-1 text-[10px] text-muted-foreground'>(brought forward)</span>}
                      </span>
                      {li.currency === 'ZiG' ? <span>{li.amount.toFixed(2)} ZiG</span> : <Money usd={li.amount} />}
                    </div>
                  ))}
                </div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Total</span><Money usd={selected.total_amount} /></div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Outstanding</span>
                  {selected.status === 'Consolidated' ? (
                    <span className='text-muted-foreground italic'>Carried forward to a later invoice</span>
                  ) : (
                    <Money usd={selected.outstanding_amount} />
                  )}
                </div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Due</span><span>{selected.due_date ?? '—'}</span></div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
