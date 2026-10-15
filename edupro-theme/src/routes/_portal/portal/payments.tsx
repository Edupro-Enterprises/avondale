import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { DataList, type DataListColumn } from '@/components/data-list'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useReceipts, type FrappeReceipt } from '@/lib/frappe/receipts'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/payments')({
  component: PaymentHistoryPage,
})

type Payment = FrappeReceipt & { studentName: string }

function PaymentHistoryPage() {
  const { data: guardian } = useMyGuardian()
  const { data: children } = useMyChildren(guardian?.name)
  const { data: receipts, isLoading } = useReceipts()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  function amountUsd(p: Pick<Payment, 'currency' | 'amount'>) {
    return p.currency === 'ZiG' ? zigToUsd(p.amount, zigPerUsd) : p.amount
  }

  const columns: DataListColumn<Payment>[] = [
    {
      id: 'student',
      header: 'Student',
      sortable: true,
      sortValue: (p) => p.studentName,
      cell: (p) => (
        <div className='flex items-center gap-3'>
          <div className='flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600'>
            <CheckCircle2 className='h-4 w-4' />
          </div>
          <div className='flex flex-col'>
            <span className='truncate'>{p.studentName}</span>
            <span className='truncate text-xs text-muted-foreground'>{p.payment_method} · {p.posting_date}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (p) => amountUsd(p),
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (p) => <Money usd={amountUsd(p)} compact />,
    },
  ]

  const allPayments = useMemo(() => {
    const childNames = new Map((children ?? []).map((c) => [c.name, formatStudentName(c.first_name, c.last_name)]))
    return (receipts ?? [])
      .filter((r) => childNames.has(r.student))
      .map((r) => ({ ...r, studentName: childNames.get(r.student)! }))
      .sort((a, b) => b.posting_date.localeCompare(a.posting_date))
  }, [receipts, children])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Payment History</h1>
        <p className='text-sm text-muted-foreground'>Across all children</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All payments</CardTitle>
          <CardDescription>{allPayments.length} recorded</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <DataList
            data={allPayments}
            columns={columns}
            getRowId={(p) => p.name}
            isLoading={isLoading}
            densityStorageKey='portal-payments'
            emptyState={{ icon: CheckCircle2, title: 'No payments yet', description: 'No payments recorded yet.' }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
