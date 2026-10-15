import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileSearch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useFeeStructures, type FrappeFeeStructure } from '@/lib/frappe/fee-structures'

export const Route = createFileRoute('/_school-head/school-head/fee-structures')({
  component: FeeStructuresPage,
})

const statusTone: Record<FrappeFeeStructure['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending Approval': 'warning',
  Approved: 'good',
  Rejected: 'bad',
}

const columns: DataListColumn<FrappeFeeStructure>[] = [
  {
    id: 'name',
    header: 'Fee Structure',
    sortable: true,
    sortValue: (fs) => fs.structure_name,
    className: 'min-w-48',
    cell: (fs) => (
      <div className='flex flex-col'>
        <span className='truncate'>{fs.structure_name}</span>
        <span className='truncate text-xs text-muted-foreground'>{fs.academic_year} · {fs.term}{fs.beneficiary_category ? ` · ${fs.beneficiary_category}` : ''}</span>
      </div>
    ),
  },
  {
    id: 'total',
    header: 'Total',
    sortable: true,
    sortValue: (fs) => fs.total_amount,
    className: 'text-right',
    headerClassName: 'text-right',
    cell: (fs) => <Money usd={fs.total_amount} />,
  },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    sortValue: (fs) => fs.workflow_state,
    cell: (fs) => <StatusBadge tone={statusTone[fs.workflow_state]}>{fs.workflow_state}</StatusBadge>,
  },
]

function FeeStructuresPage() {
  const { data: feeStructures, isLoading, error } = useFeeStructures()
  const rows = useMemo(() => feeStructures ?? [], [feeStructures])

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: ['Draft', 'Pending Approval', 'Approved', 'Rejected'] },
      { key: 'year', label: 'Academic Year', options: [...new Set(rows.map((fs) => fs.academic_year))].sort().reverse() },
      { key: 'term', label: 'Term', options: [...new Set(rows.map((fs) => fs.term))].sort() },
    ],
    [rows]
  )
  const filters = useFilters('school-head-fee-structures', filterGroups)

  const filtered = useMemo(
    () =>
      rows.filter(
        (fs) =>
          fs.structure_name.toLowerCase().includes(filters.search.toLowerCase()) &&
          (!filters.values.status || fs.workflow_state === filters.values.status) &&
          (!filters.values.year || fs.academic_year === filters.values.year) &&
          (!filters.values.term || fs.term === filters.values.term)
      ),
    [rows, filters.search, filters.values]
  )

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Fee Structures</h1>
          <p className='text-sm text-muted-foreground'>Read-only — approval is Bursar drafts, Fees Approver signs off.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load fee structures from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All fee structures</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(fs) => fs.name}
              isLoading={isLoading}
              densityStorageKey='school-head-fee-structures'
              emptyState={{
                icon: FileSearch,
                title: 'No fee structures found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Fee structures will appear here once drafted.',
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
