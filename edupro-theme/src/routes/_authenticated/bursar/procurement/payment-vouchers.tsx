import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FilePlus2, FileSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { usePaymentMethods } from '@/lib/frappe/receipts'
import { usePurchaseOrders } from '@/lib/frappe/purchase-orders'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import {
  usePaymentVouchers,
  useCreatePaymentVoucher,
  useSubmitPaymentVoucherForApproval,
  type FrappePaymentVoucher,
} from '@/lib/frappe/payment-vouchers'
import type { Fund } from '@/lib/frappe/journal-entries'

export const Route = createFileRoute('/_authenticated/bursar/procurement/payment-vouchers')({
  component: PaymentVouchersPage,
})

const statusTone: Record<FrappePaymentVoucher['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending SDC Co-Approval': 'warning',
  'Pending School Head Approval': 'warning',
  Approved: 'good',
  Rejected: 'bad',
}

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'fund', label: 'Fund', options: ['Fund A - General/Government', 'Fund B - SDC/SDA'] satisfies Fund[] },
]

function PaymentVouchersPage() {
  const { data: vouchers, isLoading, error } = usePaymentVouchers()
  const { data: purchaseOrders } = usePurchaseOrders()
  const { data: paymentMethods } = usePaymentMethods()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const filters = useFilters('payment-vouchers', FILTER_GROUPS)
  function amountUsd(v: { currency: string; amount: number }) {
    return v.currency === 'ZiG' ? zigToUsd(v.amount, zigPerUsd) : v.amount
  }

  const [newOpen, setNewOpen] = useState(false)
  const [purchaseOrder, setPurchaseOrder] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const createVoucher = useCreatePaymentVoucher()
  const submitForApproval = useSubmitPaymentVoucherForApproval()

  const rows = useMemo(() => vouchers ?? [], [vouchers])
  const selected = rows.find((v) => v.name === selectedName) ?? null

  const eligiblePOs = useMemo(() => {
    const voucheredPOs = new Set(rows.map((v) => v.purchase_order))
    return (purchaseOrders ?? []).filter((po) => po.status === 'Issued' && !voucheredPOs.has(po.name))
  }, [purchaseOrders, rows])

  const filtered = useMemo(
    () => rows.filter((v) => v.name.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.fund || v.fund === filters.values.fund)),
    [rows, filters.search, filters.values]
  )

  async function submitNew() {
    if (!purchaseOrder || !paymentMethod) {
      toast.error('Pick a purchase order and a payment method.')
      return
    }
    try {
      const name = await createVoucher.mutateAsync({ purchaseOrder, paymentMethod })
      toast.success(`${name} created as Draft`)
      setNewOpen(false)
      setPurchaseOrder('')
      setPaymentMethod('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this voucher.')
    }
  }

  async function handleSubmitForApproval() {
    if (!selected) return
    try {
      await submitForApproval.mutateAsync(selected.name)
      toast.success(`${selected.name} submitted for approval`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not submit this voucher.')
    }
  }

  const columns: DataListColumn<FrappePaymentVoucher>[] = [
    { id: 'id', header: 'Voucher', sortable: true, sortValue: (v) => v.name, cell: (v) => v.name },
    { id: 'po', header: 'Purchase Order', sortable: true, sortValue: (v) => v.purchase_order, cell: (v) => v.purchase_order },
    { id: 'fund', header: 'Fund', sortable: true, sortValue: (v) => v.fund, cell: (v) => (v.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B') },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (v) => v.amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (v) => <Money usd={amountUsd(v)} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (v) => v.workflow_state,
      cell: (v) => <StatusBadge tone={statusTone[v.workflow_state]}>{v.disbursed ? 'Disbursed' : v.workflow_state}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Procurement</p>
            <h1 className='text-3xl font-bold tracking-tight'>Payment Vouchers</h1>
            <p className='text-sm text-muted-foreground'>Fund A skips SDC co-approval; Fund B requires it. Approval itself belongs to SDC/School Head, not the Bursar.</p>
          </div>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><FilePlus2 className='h-4 w-4' />New voucher</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a payment voucher</DialogTitle></DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='po'>Purchase order</Label>
                  <Select value={purchaseOrder} onValueChange={setPurchaseOrder}>
                    <SelectTrigger id='po'><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>
                      {eligiblePOs.map((po) => <SelectItem key={po.name} value={po.name}>{po.name} — {po.vendor_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {eligiblePOs.length === 0 && <p className='text-xs text-muted-foreground'>No issued purchase orders are awaiting a voucher.</p>}
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='payment-method'>Payment method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id='payment-method'><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>
                      {(paymentMethods ?? []).map((pm) => <SelectItem key={pm.name} value={pm.name}>{pm.method_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitNew} disabled={createVoucher.isPending}>{createVoucher.isPending ? 'Creating…' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load payment vouchers from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All vouchers</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(v) => v.name}
              isLoading={isLoading}
              onRowClick={(v) => setSelectedName(v.name)}
              densityStorageKey='payment-vouchers'
              emptyState={{
                icon: FileSearch,
                title: 'No payment vouchers found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Vouchers will appear here once created.',
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
              <DialogDescription>{selected?.fund}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Purchase order</span><span>{selected.purchase_order}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Amount</span><Money usd={amountUsd(selected)} /></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Payment method</span><span>{selected.payment_method}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Status</span><StatusBadge tone={statusTone[selected.workflow_state]}>{selected.workflow_state}</StatusBadge></div>
                {selected.is_sensitive_procurement === 1 && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Sensitive-procurement co-sign</span>
                    <span>{selected.sensitive_co_signed_by ?? 'Awaiting District Auditor'}</span>
                  </div>
                )}
                {selected.disbursed === 1 && <p className='text-xs text-emerald-600'>Disbursed.</p>}
              </div>
            )}
            {selected?.workflow_state === 'Draft' && (
              <DialogFooter>
                <Button onClick={handleSubmitForApproval} disabled={submitForApproval.isPending}>
                  {submitForApproval.isPending ? 'Submitting…' : 'Submit for approval'}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
