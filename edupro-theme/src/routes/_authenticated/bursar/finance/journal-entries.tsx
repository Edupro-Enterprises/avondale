import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useJournalEntries, useJournalEntry, type FrappeJournalEntry, type Fund } from '@/lib/frappe/journal-entries'
import { useAccounts } from '@/lib/frappe/accounts'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import { Money } from '@/components/money'

export const Route = createFileRoute('/_authenticated/bursar/finance/journal-entries')({
  component: JournalEntriesPage,
})

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'fund', label: 'Fund', options: ['Fund A - General/Government', 'Fund B - SDC/SDA'] satisfies Fund[] },
]

/** ~70 entries on production predate fund-tagging and read back null --
 * treat those as Fund A, the documented default for fee-side entries. */
function resolvedFund(je: FrappeJournalEntry): Fund {
  return je.fund ?? 'Fund A - General/Government'
}

function JournalEntriesPage() {
  const { data: entries, isLoading, error } = useJournalEntries()
  const { data: accounts } = useAccounts()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const filters = useFilters('journal-entries', FILTER_GROUPS)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useJournalEntry(selectedName ?? undefined)

  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  /** total_debit/total_credit are the doctype's own BASE_CURRENCY (ZiG)
   * totals -- converted here since every list/dashboard/report in this app
   * shows USD (see lib/currency.ts). Per-line amounts are in that line's
   * own account's native currency instead. */
  const totalUsd = (ziG: number) => zigToUsd(ziG, zigPerUsd)
  const lineUsd = (amount: number, account: string) => (accountCurrency.get(account) === 'USD' ? amount : zigToUsd(amount, zigPerUsd))

  const rows = useMemo(() => entries ?? [], [entries])

  const filtered = useMemo(
    () =>
      rows.filter(
        (je) =>
          (je.name.toLowerCase().includes(filters.search.toLowerCase()) ||
            (je.reference_name ?? '').toLowerCase().includes(filters.search.toLowerCase())) &&
          (!filters.values.fund || resolvedFund(je) === filters.values.fund)
      ),
    [rows, filters.search, filters.values]
  )

  const columns: DataListColumn<FrappeJournalEntry>[] = [
    { id: 'id', header: 'Entry', sortable: true, sortValue: (je) => je.name, cell: (je) => je.name },
    { id: 'date', header: 'Date', sortable: true, sortValue: (je) => je.posting_date, cell: (je) => je.posting_date },
    {
      id: 'reference',
      header: 'Reference',
      sortable: true,
      sortValue: (je) => je.reference_name ?? '',
      className: 'min-w-40',
      cell: (je) => (
        <div className='flex flex-col'>
          <span className='truncate'>{je.reference_name ?? '—'}</span>
          {je.reference_doctype && <span className='truncate text-xs text-muted-foreground'>{je.reference_doctype}</span>}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (je) => je.total_debit,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (je) => <Money usd={totalUsd(je.total_debit)} />,
    },
    {
      id: 'fund',
      header: 'Fund',
      sortable: true,
      sortValue: (je) => resolvedFund(je),
      cell: (je) => <StatusBadge tone='neutral'>{resolvedFund(je).startsWith('Fund A') ? 'Fund A' : 'Fund B'}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Finance</p>
          <h1 className='text-3xl font-bold tracking-tight'>Journal Entries</h1>
          <p className='text-sm text-muted-foreground'>Read-only general ledger feed. Both funds visible to the Bursar.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load journal entries from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Live feed</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}, most recent first</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by entry or reference…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(je) => je.name}
              isLoading={isLoading}
              onRowClick={(je) => setSelectedName(je.name)}
              densityStorageKey='journal-entries'
              defaultSort={[{ id: 'date', desc: true }]}
              emptyState={{
                icon: BookOpen,
                title: 'No journal entries found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Entries post here automatically from receipts and disbursements.',
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
              <DialogDescription>
                {selected?.posting_date} · {selected?.fund}
                {selected?.reversal_of && ` · reverses ${selected.reversal_of}`}
                {selected?.reversed_by && ` · reversed by ${selected.reversed_by}`}
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                {selected.remarks && <p className='text-muted-foreground'>{selected.remarks}</p>}
                <div className='divide-y rounded-md border'>
                  {selected.entries.map((line) => (
                    <div key={line.name} className='flex items-center justify-between px-3 py-2'>
                      <span>{line.account}</span>
                      <span>
                        {line.debit > 0 && <span>Dr <Money usd={lineUsd(line.debit, line.account)} /></span>}
                        {line.credit > 0 && <span>Cr <Money usd={lineUsd(line.credit, line.account)} /></span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className='flex justify-between font-medium'>
                  <span>Total</span>
                  <Money usd={totalUsd(selected.total_debit)} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
