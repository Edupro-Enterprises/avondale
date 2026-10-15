import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useStudentInvoices, computeFeeStatus } from '@/lib/frappe/invoices'
import { useReceipts } from '@/lib/frappe/receipts'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/students/$studentId/statement')({
  component: StatementPage,
})

function StatementPage() {
  const { studentId } = Route.useParams()
  const { data: guardian } = useMyGuardian()
  const { data: children } = useMyChildren(guardian?.name)
  const student = children?.find((c) => c.name === studentId)
  const { data: invoices } = useStudentInvoices(student?.name ?? '')
  const { data: receipts } = useReceipts()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  const { balanceUSD } = computeFeeStatus(invoices ?? [])

  const lines = useMemo(() => {
    const studentReceipts = (receipts ?? []).filter((r) => r.student === studentId)
    return [
      ...(invoices ?? []).map((i) => ({ id: i.name, date: i.posting_date, description: 'Invoice', amountUSD: i.total_amount, kind: 'charge' as const })),
      ...studentReceipts.map((r) => ({
        id: r.name,
        date: r.posting_date,
        description: `Payment — ${r.payment_method}`,
        amountUSD: -(r.currency === 'ZiG' ? zigToUsd(r.amount, zigPerUsd) : r.amount),
        kind: 'payment' as const,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))
  }, [invoices, receipts, studentId, zigPerUsd])

  return (
    <div className='space-y-6'>
      <Link to='/portal/students/$studentId' params={{ studentId }} className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='h-4 w-4' />
        {student ? formatStudentName(student.first_name, student.last_name) : ''}
      </Link>

      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Statement</h1>
        <p className='text-sm text-muted-foreground'>{student ? formatStudentName(student.first_name, student.last_name) : ''} · {student?.grade ?? '—'}</p>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>Current balance</CardTitle>
        </CardHeader>
        <CardContent>
          <Money usd={balanceUSD} className='text-2xl' />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itemized activity</CardTitle>
          <CardDescription>{student?.current_term ?? student?.academic_year ?? '—'}</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='divide-y'>
            {lines.map((line) => (
              <div key={line.id} className='flex items-center justify-between gap-4 py-3'>
                <div>
                  <p className='text-sm font-medium'>{line.description}</p>
                  <p className='text-xs text-muted-foreground'>{line.date}</p>
                </div>
                <Money usd={Math.abs(line.amountUSD)} compact className={line.kind === 'payment' ? 'text-emerald-600' : undefined} />
              </div>
            ))}
            {lines.length === 0 && <p className='py-3 text-sm text-muted-foreground'>No activity recorded yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
