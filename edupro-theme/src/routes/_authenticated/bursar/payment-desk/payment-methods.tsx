import { createFileRoute } from '@tanstack/react-router'
import { CreditCard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { DataList, type DataListColumn } from '@/components/data-list'
import { usePaymentMethods, type FrappePaymentMethod } from '@/lib/frappe/receipts'

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/payment-methods')({
  component: PaymentMethodsPage,
})

const columns: DataListColumn<FrappePaymentMethod>[] = [
  { id: 'name', header: 'Method', sortable: true, sortValue: (pm) => pm.method_name, className: 'min-w-48', cell: (pm) => pm.method_name },
  { id: 'type', header: 'Type', sortable: true, sortValue: (pm) => pm.method_type, cell: (pm) => pm.method_type },
  {
    id: 'currency',
    header: 'Currency',
    sortable: true,
    sortValue: (pm) => pm.currency,
    cell: (pm) => <StatusBadge tone='neutral'>{pm.currency}</StatusBadge>,
  },
]

function PaymentMethodsPage() {
  const { data: paymentMethods, isLoading, error } = usePaymentMethods()

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Payment Desk</p>
          <h1 className='text-3xl font-bold tracking-tight'>Payment Methods</h1>
          <p className='text-sm text-muted-foreground'>Read-only reference -- payment methods are managed by a System Administrator.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load payment methods from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Configured methods</CardTitle>
            <CardDescription>{(paymentMethods ?? []).length} configured</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={paymentMethods ?? []}
              columns={columns}
              getRowId={(pm) => pm.name}
              isLoading={isLoading}
              densityStorageKey='payment-methods'
              emptyState={{ icon: CreditCard, title: 'No payment methods found', description: 'Payment methods will appear here once configured.' }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
