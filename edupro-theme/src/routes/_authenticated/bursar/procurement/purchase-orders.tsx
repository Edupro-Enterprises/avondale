import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { usePurchaseOrders, type FrappePurchaseOrder } from '@/lib/frappe/purchase-orders'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'

export const Route = createFileRoute('/_authenticated/bursar/procurement/purchase-orders')({
  component: PurchaseOrdersPage,
})

const statusTone: Record<FrappePurchaseOrder['status'], StatusTone> = { Draft: 'neutral', Issued: 'good', Cancelled: 'bad' }

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'status', label: 'Status', options: ['Draft', 'Issued', 'Cancelled'] }]

function PurchaseOrdersPage() {
  const { data: purchaseOrders, isLoading, error } = usePurchaseOrders()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const filters = useFilters('purchase-orders', FILTER_GROUPS)
  function amountUsd(po: { currency: string; amount: number }) {
    return po.currency === 'ZiG' ? zigToUsd(po.amount, zigPerUsd) : po.amount
  }
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const rows = useMemo(() => purchaseOrders ?? [], [purchaseOrders])
  const filtered = useMemo(
    () => rows.filter((po) => po.vendor_name.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.status || po.status === filters.values.status)),
    [rows, filters.search, filters.values]
  )
  const selected = rows.find((po) => po.name === selectedName) ?? null

  const columns: DataListColumn<FrappePurchaseOrder>[] = [
    {
      id: 'vendor',
      header: 'Vendor',
      sortable: true,
      sortValue: (po) => po.vendor_name,
      className: 'min-w-48',
      cell: (po) => (
        <div className='flex flex-col'>
          <span className='truncate'>{po.vendor_name}</span>
          <span className='truncate text-xs text-muted-foreground'>{po.name} · from {po.requisition} · {po.posting_date}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (po) => po.amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (po) => <Money usd={amountUsd(po)} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (po) => po.status,
      cell: (po) => (
        <div className='flex items-center gap-1.5'>
          <StatusBadge tone={statusTone[po.status]}>{po.status}</StatusBadge>
          {po.is_sensitive_procurement === 1 && <StatusBadge tone='warning'>Sensitive</StatusBadge>}
        </div>
      ),
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Procurement</p>
            <h1 className='text-3xl font-bold tracking-tight'>Purchase Orders</h1>
            <p className='text-sm text-muted-foreground'>Issued from an Open requisition once enough quotations are logged and one is selected.</p>
          </div>
          <Button asChild variant='outline'>
            <Link to='/bursar/procurement/requisitions'>Go to Requisitions</Link>
          </Button>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load purchase orders from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All purchase orders</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by vendor…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(po) => po.name}
              isLoading={isLoading}
              onRowClick={(po) => setSelectedName(po.name)}
              densityStorageKey='purchase-orders'
              emptyState={{
                icon: FileText,
                title: 'No purchase orders found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Purchase orders will appear here once issued.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.vendor_name}</DialogTitle>
              <DialogDescription>{selected?.name} · from {selected?.requisition}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Fund</span><span>{selected.fund}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Budget line</span><span>{selected.budget_line}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Amount</span><Money usd={amountUsd(selected)} /></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Posted</span><span>{selected.posting_date}</span></div>
                {selected.is_sensitive_procurement === 1 && (
                  <p className='text-xs text-amber-600'>At or above the sensitive-procurement threshold -- its Payment Voucher needs a District Education Auditor/Inspector co-signature.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
