import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { useMyStudent } from '@/lib/frappe/students'
import { useStudentInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'

export const Route = createFileRoute('/_student/student/')({
  component: StudentDashboard,
})

const statusTone: Record<FeeStatus, StatusTone> = {
  paid: 'good',
  partial: 'warning',
  overdue: 'bad',
  pending: 'neutral',
}

function StudentDashboard() {
  const { data: student, isLoading } = useMyStudent()
  const { data: invoices } = useStudentInvoices(student?.name ?? '')

  if (!isLoading && !student) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-sm text-muted-foreground'>
          Your account isn't linked to a student record yet. Ask your school's office to link it.
        </CardContent>
      </Card>
    )
  }

  const { status, balanceUSD } = computeFeeStatus(invoices ?? [])

  return (
    <div className='space-y-6'>
      <div>
        <p className='text-sm text-muted-foreground'>Good day, {student?.first_name}</p>
        <h1 className='text-2xl font-bold tracking-tight'>My fees</h1>
        <p className='text-sm text-muted-foreground'>{student?.grade ?? '—'} · {student?.name}</p>
      </div>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>Outstanding balance</CardTitle>
          <StatusBadge tone={statusTone[status]}>{status}</StatusBadge>
        </CardHeader>
        <CardContent>
          <Money usd={balanceUSD} className='text-2xl' />
        </CardContent>
      </Card>

      <div className='grid gap-3 sm:grid-cols-2'>
        <Link to='/student/statement'>
          <Card className='h-full transition-colors hover:bg-muted/50'>
            <CardContent className='py-5'>
              <p className='font-medium'>Statement</p>
              <p className='text-sm text-muted-foreground'>Itemized charges for the term</p>
            </CardContent>
          </Card>
        </Link>
        <Link to='/student/payment-plan'>
          <Card className='h-full transition-colors hover:bg-muted/50'>
            <CardContent className='py-5'>
              <p className='font-medium'>Payment Plan</p>
              <p className='text-sm text-muted-foreground'>Installment schedule, if any</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <p className='text-xs text-muted-foreground'>
        For payments, ask your parent/guardian to use the Parent Portal — students don't initiate payments directly.
      </p>
    </div>
  )
}
