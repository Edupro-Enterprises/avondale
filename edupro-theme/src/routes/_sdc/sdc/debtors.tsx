import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { HandCoins } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useDebtorCases, useDebtorCase, type FrappeDebtorCase, type AgeingBucket, type DebtorCaseStatus } from '@/lib/frappe/debtor-cases'
import { useStudents, useGuardians } from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_sdc/sdc/debtors')({
  component: SdcDebtorCasesPage,
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

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'status', label: 'Status', options: ['Open', 'Payment Plan Active', 'Escalated', 'Legal', 'Resolved'] },
]

function SdcDebtorCasesPage() {
  const { data: cases, isLoading, error } = useDebtorCases()
  const { data: students } = useStudents()
  const filters = useFilters('sdc-debtors', FILTER_GROUPS)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useDebtorCase(selectedName ?? undefined)
  const guardianNames = useMemo(() => [selected?.parent_guardian].filter((g): g is string => !!g), [selected?.parent_guardian])
  const { data: guardians } = useGuardians(guardianNames)
  const guardian = guardians?.[0]

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) map.set(s.name, formatStudentName(s.first_name, s.last_name))
    return map
  }, [students])

  const rows = useMemo(() => cases ?? [], [cases])
  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((c) => {
      const studentName = studentNames.get(c.student) ?? c.student
      return studentName.toLowerCase().includes(search) && (!filters.values.status || c.workflow_state === filters.values.status)
    })
  }, [rows, studentNames, filters.search, filters.values])

  const columns: DataListColumn<FrappeDebtorCase>[] = [
    { id: 'student', header: 'Student', sortable: true, sortValue: (c) => studentNames.get(c.student) ?? c.student, className: 'min-w-40', cell: (c) => studentNames.get(c.student) ?? c.student },
    {
      id: 'ageing',
      header: 'Ageing',
      sortable: true,
      sortValue: (c) => c.ageing_bucket,
      cell: (c) => <StatusBadge tone={bucketTone[c.ageing_bucket]}>{c.ageing_bucket}</StatusBadge>,
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      sortable: true,
      sortValue: (c) => c.outstanding_amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (c) => <Money usd={c.outstanding_amount} compact />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (c) => c.workflow_state,
      cell: (c) => <StatusBadge tone={statusTone[c.workflow_state]}>{c.workflow_state}</StatusBadge>,
    },
  ]

  return (
    <>
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Debtor Cases</h1>
          <p className='text-sm text-muted-foreground'>Read-only oversight of the Bursar's debtor management.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load debtor cases from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

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
              densityStorageKey='sdc-debtors'
              emptyState={{
                icon: HandCoins,
                title: 'No debtor cases found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Cases will appear here once opened.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected ? studentNames.get(selected.student) ?? selected.student : ''}</DialogTitle>
              <DialogDescription>{selected?.name}{selected?.assigned_to && ` · assigned to ${selected.assigned_to}`}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Outstanding</span><Money usd={selected.outstanding_amount} /></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Ageing</span><span>{selected.ageing_bucket}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Guardian</span><span>{guardian?.full_name ?? '—'}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Opened</span><span>{selected.opened_on ?? '—'}</span></div>
                {selected.legal_escalation_notes && (
                  <div>
                    <p className='text-muted-foreground'>Legal escalation notes</p>
                    <p>{selected.legal_escalation_notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
