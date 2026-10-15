import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarRange, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAcademicYears, useCreateAcademicYear, useSetAcademicYearCurrent, type FrappeAcademicYear } from '@/lib/frappe/academic-years'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/academic-years')({
  component: AcademicYearsPage,
})

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'status', label: 'Status', options: ['Current', 'Not current'] }]

function AcademicYearsPage() {
  const { data: academicYears, isLoading, error } = useAcademicYears()
  const createAcademicYear = useCreateAcademicYear()
  const setCurrent = useSetAcademicYearCurrent()
  const filters = useFilters('academic-years', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function submit() {
    if (!name.trim() || !startDate || !endDate) {
      toast.error('Name, start date and end date are all required.')
      return
    }
    try {
      await createAcademicYear.mutateAsync({ academic_year_name: name.trim(), start_date: startDate, end_date: endDate })
      toast.success('Academic year created -- 3 terms generated automatically')
      setAddOpen(false)
      setName('')
      setStartDate('')
      setEndDate('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this academic year.')
    }
  }

  async function handleSetCurrent(ay: FrappeAcademicYear) {
    try {
      await setCurrent.mutateAsync(ay.name)
      toast.success(`${ay.academic_year_name} set as current`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this academic year.')
    }
  }

  const rows = useMemo(() => academicYears ?? [], [academicYears])
  const filtered = useMemo(
    () =>
      rows.filter(
        (ay) =>
          ay.academic_year_name.toLowerCase().includes(filters.search.toLowerCase()) &&
          (!filters.values.status || (filters.values.status === 'Current' ? ay.is_current === 1 : ay.is_current !== 1))
      ),
    [rows, filters.search, filters.values]
  )

  const columns: DataListColumn<FrappeAcademicYear>[] = [
    {
      id: 'name',
      header: 'Year',
      sortable: true,
      sortValue: (ay) => ay.academic_year_name,
      cell: (ay) => (
        <>
          {ay.academic_year_name} {ay.is_current === 1 && <StatusBadge tone='good' className='ml-1'>Current</StatusBadge>}
        </>
      ),
    },
    { id: 'dates', header: 'Dates', sortable: true, sortValue: (ay) => ay.start_date, cell: (ay) => `${ay.start_date} – ${ay.end_date}` },
    {
      id: 'actions',
      header: '',
      cell: (ay) =>
        ay.is_current !== 1 ? (
          <Button variant='outline' size='sm' onClick={() => handleSetCurrent(ay)} disabled={setCurrent.isPending}>
            Set as current
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup · Academic Structure</p>
            <h1 className='text-3xl font-bold tracking-tight'>Academic Years</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add year</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add an academic year</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Name' className='col-span-2'>
                  <Input className={compactControlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder='2027 Academic Year' />
                </CompactField>
                <CompactField label='Start date'>
                  <Input type='date' className={compactControlClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </CompactField>
                <CompactField label='End date'>
                  <Input type='date' className={compactControlClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createAcademicYear.isPending}>{createAcademicYear.isPending ? 'Creating…' : 'Add year'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load academic years from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All academic years</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(ay) => ay.name}
              isLoading={isLoading}
              densityStorageKey='academic-years'
              emptyState={{
                icon: CalendarRange,
                title: 'No academic years found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Academic years will appear here once added.',
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
