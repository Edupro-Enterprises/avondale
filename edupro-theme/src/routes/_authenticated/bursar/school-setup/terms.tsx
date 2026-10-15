import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useAcademicYears } from '@/lib/frappe/academic-years'
import { FrappeApiError } from '@/lib/frappe/client'
import { useTerms, useUpdateTerm, useSetTermCurrent, type FrappeTerm } from '@/lib/frappe/terms'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/terms')({
  component: TermsPage,
})

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'status', label: 'Status', options: ['Current', 'Not current'] }]

function TermsPage() {
  const { data: terms, isLoading, error } = useTerms()
  const { data: academicYears } = useAcademicYears()
  const updateTerm = useUpdateTerm()
  const setCurrent = useSetTermCurrent()
  const filters = useFilters('terms', FILTER_GROUPS)
  const [editing, setEditing] = useState<FrappeTerm | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const academicYearNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const y of academicYears ?? []) map.set(y.name, y.academic_year_name)
    return map
  }, [academicYears])

  const rows = useMemo(() => terms ?? [], [terms])
  const filtered = useMemo(
    () =>
      rows.filter(
        (t) =>
          t.term_name.toLowerCase().includes(filters.search.toLowerCase()) &&
          (!filters.values.status || (filters.values.status === 'Current' ? t.is_current === 1 : t.is_current !== 1))
      ),
    [rows, filters.search, filters.values]
  )

  function openEdit(t: FrappeTerm) {
    setEditing(t)
    setStartDate(t.start_date)
    setEndDate(t.end_date)
  }

  async function saveEdit() {
    if (!editing) return
    try {
      await updateTerm.mutateAsync({ name: editing.name, input: { start_date: startDate, end_date: endDate } })
      toast.success('Term updated')
      setEditing(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this term.')
    }
  }

  async function handleSetCurrent(t: FrappeTerm) {
    try {
      await setCurrent.mutateAsync(t.name)
      toast.success(`${t.term_name} set as current`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this term.')
    }
  }

  const columns: DataListColumn<FrappeTerm>[] = [
    {
      id: 'name',
      header: 'Term',
      sortable: true,
      sortValue: (t) => t.term_name,
      className: 'min-w-48',
      cell: (t) => (
        <div className='flex flex-col'>
          <span className='truncate'>
            {t.term_name} · {academicYearNames.get(t.academic_year) ?? t.academic_year}
            {t.is_current === 1 && <StatusBadge tone='good' className='ml-1'>Current</StatusBadge>}
          </span>
          <span className='truncate text-xs text-muted-foreground'>{t.start_date} – {t.end_date}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (t) => (
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='sm' onClick={() => openEdit(t)}>Edit dates</Button>
          {t.is_current !== 1 && (
            <Button variant='outline' size='sm' onClick={() => handleSetCurrent(t)} disabled={setCurrent.isPending}>Set as current</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup · Academic Structure</p>
            <h1 className='text-3xl font-bold tracking-tight'>Terms</h1>
            <p className='text-sm text-muted-foreground'>Terms are generated automatically when an academic year is created.</p>
          </div>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load terms from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All terms</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(t) => t.name}
              isLoading={isLoading}
              densityStorageKey='terms'
              emptyState={{
                icon: CalendarClock,
                title: 'No terms found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Terms appear here once an academic year is created.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit {editing?.term_name}</DialogTitle></DialogHeader>
            <div className='grid grid-cols-2 gap-3 py-2'>
              <CompactField label='Start date'>
                <Input type='date' className={compactControlClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </CompactField>
              <CompactField label='End date'>
                <Input type='date' className={compactControlClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </CompactField>
            </div>
            <DialogFooter>
              <Button onClick={saveEdit} disabled={updateTerm.isPending}>{updateTerm.isPending ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
