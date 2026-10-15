import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useJournalEntries, useJournalEntry, type FrappeJournalEntry, type Fund } from '@/lib/frappe/journal-entries'
import { formatZiG } from '@/lib/currency'

export const Route = createFileRoute('/_sdc/sdc/journal-entries')({
  component: SdcJournalEntriesPage,
})

/** ~70 entries on production predate fund-tagging and read back null --
 * treat those as Fund A, so they never wrongly leak into the Fund B feed. */
function resolvedFund(je: FrappeJournalEntry): Fund {
  return je.fund ?? 'Fund A - General/Government'
}

const columns: DataListColumn<FrappeJournalEntry>[] = [
  { id: 'id', header: 'Entry', sortable: true, sortValue: (je) => je.name, cell: (je) => je.name },
  { id: 'date', header: 'Date', sortable: true, sortValue: (je) => je.posting_date, cell: (je) => je.posting_date },
  { id: 'description', header: 'Description', className: 'min-w-48', cell: (je) => je.remarks ?? je.reference_name ?? '—' },
  {
    id: 'amount',
    header: 'Amount',
    sortable: true,
    sortValue: (je) => je.total_debit,
    className: 'text-right',
    headerClassName: 'text-right',
    cell: (je) => <span className='tabular-nums'>{formatZiG(je.total_debit)}</span>,
  },
]

function SdcJournalEntriesPage() {
  const { data: entries, isLoading, error } = useJournalEntries()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useJournalEntry(selectedName ?? undefined)

  const fundBEntries = useMemo(() => (entries ?? []).filter((je) => resolvedFund(je) === 'Fund B - SDC/SDA'), [entries])

  return (
    <>
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Journal Entries</h1>
          <p className='text-sm text-muted-foreground'>Read-only, Fund B (SDC/SDA) only.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load journal entries from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fund B ledger feed</CardTitle>
            <CardDescription>{fundBEntries.length} entries, most recent first</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={fundBEntries}
              columns={columns}
              getRowId={(je) => je.name}
              isLoading={isLoading}
              onRowClick={(je) => setSelectedName(je.name)}
              densityStorageKey='sdc-journal-entries'
              defaultSort={[{ id: 'date', desc: true }]}
              emptyState={{ icon: BookOpen, title: 'No Fund B entries', description: 'No Fund B entries posted yet.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription>{selected?.posting_date}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                {selected.remarks && <p className='text-muted-foreground'>{selected.remarks}</p>}
                <div className='divide-y rounded-md border'>
                  {selected.entries.map((line) => (
                    <div key={line.name} className='flex items-center justify-between px-3 py-2'>
                      <span>{line.account}</span>
                      <span>
                        {line.debit > 0 && <span>Dr {formatZiG(line.debit)}</span>}
                        {line.credit > 0 && <span>Cr {formatZiG(line.credit)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className='flex justify-between font-medium'>
                  <span>Total</span>
                  <span className='tabular-nums'>{formatZiG(selected.total_debit)}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
