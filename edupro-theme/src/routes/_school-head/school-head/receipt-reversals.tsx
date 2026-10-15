import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { DataList, type DataListColumn } from '@/components/data-list'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { FrappeApiError } from '@/lib/frappe/client'
import { usePendingReceiptReversals, useApproveReceiptReversal, type PendingReceiptReversal } from '@/lib/frappe/receipts'

export const Route = createFileRoute('/_school-head/school-head/receipt-reversals')({
  component: ReceiptReversalsPage,
})

function ReceiptReversalsPage() {
  const { data: pending, isLoading, error } = usePendingReceiptReversals()
  const approveReversal = useApproveReceiptReversal()
  const [selected, setSelected] = useState<PendingReceiptReversal | null>(null)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  function amountUsd(r: Pick<PendingReceiptReversal, 'currency' | 'amount'>) {
    return r.currency === 'ZiG' ? zigToUsd(r.amount, zigPerUsd) : r.amount
  }

  const columns: DataListColumn<PendingReceiptReversal>[] = [
    {
      id: 'student',
      header: 'Student',
      sortable: true,
      sortValue: (r) => r.student,
      className: 'min-w-40',
      cell: (r) => (
        <div className='flex flex-col'>
          <span className='truncate'>{r.student}</span>
          <span className='truncate text-xs text-muted-foreground'>{r.name} · reverses {r.reversal_of}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (r) => amountUsd(r),
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (r) => <Money usd={amountUsd(r)} />,
    },
  ]

  async function approve() {
    if (!selected) return
    try {
      await approveReversal.mutateAsync(selected.name)
      toast.success('Receipt reversed')
      setSelected(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not approve this reversal.')
    }
  }

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Receipt Reversals</h1>
          <p className='text-sm text-muted-foreground'>Only the School Head can approve a receipt reversal.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load reversal requests from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Pending your decision</CardTitle>
            <CardDescription>{(pending ?? []).length} awaiting approval</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={pending ?? []}
              columns={columns}
              getRowId={(r) => r.name}
              isLoading={isLoading}
              onRowClick={(r) => setSelected(r)}
              densityStorageKey='receipt-reversals-pending'
              emptyState={{ icon: Undo2, title: 'No reversal requests pending', description: 'Reversal requests will appear here when submitted.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reverse {selected?.reversal_of}?</DialogTitle>
              <DialogDescription>{selected?.student} · <Money usd={selected ? amountUsd(selected) : 0} /></DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-1 text-sm'>
                <p><span className='text-muted-foreground'>Requested by</span> {selected.owner}</p>
                <p><span className='text-muted-foreground'>Reason:</span> {selected.reversal_reason}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant='destructive' disabled={approveReversal.isPending} onClick={approve}>Approve reversal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
