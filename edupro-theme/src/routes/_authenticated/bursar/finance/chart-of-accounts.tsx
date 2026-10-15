import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useAccounts, type FrappeAccount } from '@/lib/frappe/accounts'

export const Route = createFileRoute('/_authenticated/bursar/finance/chart-of-accounts')({
  component: ChartOfAccountsPage,
})

const typeTone: Record<FrappeAccount['account_type'], StatusTone> = {
  Asset: 'info',
  Liability: 'warning',
  Equity: 'neutral',
  Income: 'good',
  Expense: 'bad',
}

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'type', label: 'Type', options: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] },
]

function ChartOfAccountsPage() {
  const { data: accounts, isLoading, error } = useAccounts()
  const filters = useFilters('chart-of-accounts', FILTER_GROUPS)

  const rows = useMemo(() => accounts ?? [], [accounts])
  const filtered = useMemo(
    () => rows.filter((a) => a.name.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.type || a.account_type === filters.values.type)),
    [rows, filters.search, filters.values]
  )

  const columns: DataListColumn<FrappeAccount>[] = [
    { id: 'name', header: 'Name', sortable: true, sortValue: (a) => a.name, className: 'min-w-48', cell: (a) => a.name },
    { id: 'fund', header: 'Fund', sortable: true, sortValue: (a) => a.fund ?? '', cell: (a) => (a.fund ? (a.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B') : '—') },
    { id: 'currency', header: 'Currency', sortable: true, sortValue: (a) => a.currency, cell: (a) => a.currency },
    {
      id: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (a) => a.account_type,
      cell: (a) => <StatusBadge tone={typeTone[a.account_type]}>{a.account_type}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Finance</p>
          <h1 className='text-3xl font-bold tracking-tight'>Chart of Accounts</h1>
          <p className='text-sm text-muted-foreground'>Read-only -- managed by a System Administrator.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load accounts from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All accounts</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by name…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(a) => a.name}
              isLoading={isLoading}
              densityStorageKey='chart-of-accounts'
              defaultSort={[{ id: 'name', desc: false }]}
              emptyState={{
                icon: BookOpen,
                title: 'No accounts found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Accounts will appear here once configured.',
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
