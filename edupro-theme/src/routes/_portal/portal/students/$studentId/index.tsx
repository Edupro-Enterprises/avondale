import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CalendarClock, GraduationCap, ReceiptText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useStudentInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/students/$studentId/')({
  component: ChildDetailPage,
})

const statusTone: Record<FeeStatus, StatusTone> = {
  paid: 'good',
  partial: 'warning',
  overdue: 'bad',
  pending: 'neutral',
}

function ChildDetailPage() {
  const { studentId } = Route.useParams()
  const { data: guardian } = useMyGuardian()
  const { data: children, isLoading } = useMyChildren(guardian?.name)
  const student = children?.find((c) => c.name === studentId)
  const { data: invoices } = useStudentInvoices(student?.name ?? '')
  const { status, balanceUSD } = computeFeeStatus(invoices ?? [])

  if (!isLoading && !student) {
    return (
      <div className='space-y-6'>
        <Link to='/portal/students' className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
          <ArrowLeft className='h-4 w-4' />
          My Children
        </Link>
        <Card><CardContent className='py-10 text-center text-sm text-muted-foreground'>This student isn't linked to your account.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <Link to='/portal/students' className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='h-4 w-4' />
        My Children
      </Link>

      <div className='flex items-center gap-4'>
        <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
          <GraduationCap className='h-6 w-6' />
        </div>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{student ? formatStudentName(student.first_name, student.last_name) : ''}</h1>
          <p className='text-sm text-muted-foreground'>{student?.name} · {student?.grade ?? '—'}</p>
        </div>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>Outstanding balance</CardTitle>
        </CardHeader>
        <CardContent className='flex items-center justify-between'>
          <Money usd={balanceUSD} className='text-2xl' />
          <StatusBadge tone={statusTone[status]}>{status}</StatusBadge>
        </CardContent>
      </Card>

      <div className='grid gap-3 sm:grid-cols-2'>
        <Link to='/portal/students/$studentId/statement' params={{ studentId }}>
          <Card className='h-full transition-colors hover:bg-muted/50'>
            <CardContent className='flex items-center gap-3 py-5'>
              <ReceiptText className='h-5 w-5 text-primary' />
              <div>
                <p className='font-medium'>Statement</p>
                <CardDescription>Itemized charges &amp; payments</CardDescription>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to='/portal/students/$studentId/payment-plan' params={{ studentId }}>
          <Card className='h-full transition-colors hover:bg-muted/50'>
            <CardContent className='flex items-center gap-3 py-5'>
              <CalendarClock className='h-5 w-5 text-primary' />
              <div>
                <p className='font-medium'>Payment Plan</p>
                <CardDescription>Installment schedule</CardDescription>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Button asChild className='w-full'>
        <Link to='/portal/pay' search={{ studentId }}>
          How to pay
        </Link>
      </Button>
    </div>
  )
}
