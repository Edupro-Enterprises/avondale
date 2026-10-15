import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { DataList, type DataListColumn } from '@/components/data-list'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { FrappeApiError } from '@/lib/frappe/client'
import { usePaymentVouchers, useDecidePaymentVoucher, type FrappePaymentVoucher } from '@/lib/frappe/payment-vouchers'

export const Route = createFileRoute('/_sdc/sdc/payment-vouchers')({
  component: SdcPaymentVouchersPage,
})

const statusTone: Record<FrappePaymentVoucher['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending SDC Co-Approval': 'warning',
  'Pending School Head Approval': 'warning',
  Approved: 'good',
  Rejected: 'bad',
}

function SdcPaymentVouchersPage() {
  const { data: vouchers, isLoading, error } = usePaymentVouchers()
  const decideVoucher = useDecidePaymentVoucher()
  const [selected, setSelected] = useState<FrappePaymentVoucher | null>(null)

  const fundBVouchers = useMemo(() => (vouchers ?? []).filter((v) => v.fund === 'Fund B - SDC/SDA'), [vouchers])
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  function amountUsd(v: Pick<FrappePaymentVoucher, 'currency' | 'amount'>) {
    return v.currency === 'ZiG' ? zigToUsd(v.amount, zigPerUsd) : v.amount
  }

  async function decide(workflow_state: 'Pending School Head Approval' | 'Rejected') {
    if (!selected) return
    try {
      await decideVoucher.mutateAsync({ name: selected.name, workflow_state })
      toast.success(workflow_state === 'Pending School Head Approval' ? 'Co-approved, sent to School Head for final sign-off' : 'Voucher rejected')
      setSelected(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this decision.')
    }
  }

  const columns: DataListColumn<FrappePaymentVoucher>[] = [
    {
      id: 'name',
      header: 'Voucher',
      sortable: true,
      sortValue: (v) => v.name,
      className: 'min-w-40',
      cell: (v) => (
        <div className='flex flex-col'>
          <span className='truncate'>{v.name}</span>
          <span className='truncate text-xs text-muted-foreground'>{v.purchase_order}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (v) => amountUsd(v),
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (v) => <Money usd={amountUsd(v)} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (v) => v.workflow_state,
      cell: (v) => <StatusBadge tone={statusTone[v.workflow_state]}>{v.workflow_state}</StatusBadge>,
    },
  ]

  return (
    <>
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Payment Vouchers</h1>
          <p className='text-sm text-muted-foreground'>Fund B (SDC/SDA) only — Fund A is outside SDC's remit.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load payment vouchers from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Fund B vouchers</CardTitle>
            <CardDescription>{fundBVouchers.length} total</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={fundBVouchers}
              columns={columns}
              getRowId={(v) => v.name}
              isLoading={isLoading}
              onRowClick={(v) => setSelected(v)}
              densityStorageKey='sdc-payment-vouchers'
              emptyState={{ icon: Receipt, title: 'No Fund B vouchers', description: 'Vouchers will appear here once raised.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription>{selected?.fund}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Amount</span><Money usd={amountUsd(selected)} /></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Purchase order</span><span>{selected.purchase_order}</span></div>
              </div>
            )}
            {selected?.workflow_state === 'Pending SDC Co-Approval' && (
              <DialogFooter className='gap-2 sm:gap-2'>
                <Button variant='outline' disabled={decideVoucher.isPending} onClick={() => decide('Rejected')}>Reject</Button>
                <Button disabled={decideVoucher.isPending} onClick={() => decide('Pending School Head Approval')}>Co-approve</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
