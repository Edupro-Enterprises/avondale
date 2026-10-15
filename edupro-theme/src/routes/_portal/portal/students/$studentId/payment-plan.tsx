import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useStudentPaymentPlan } from '@/lib/frappe/payment-plans'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/students/$studentId/payment-plan')({
  component: PaymentPlanPage,
})

const tone: Record<string, StatusTone> = { Paid: 'good', Pending: 'neutral', Overdue: 'bad' }

function PaymentPlanPage() {
  const { studentId } = Route.useParams()
  const { data: guardian } = useMyGuardian()
  const { data: children } = useMyChildren(guardian?.name)
  const student = children?.find((c) => c.name === studentId)
  const { data: plan } = useStudentPaymentPlan(student?.name)

  return (
    <div className='space-y-6'>
      <Link to='/portal/students/$studentId' params={{ studentId }} className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='h-4 w-4' />
        {student ? formatStudentName(student.first_name, student.last_name) : ''}
      </Link>

      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Payment Plan</h1>
        <p className='text-sm text-muted-foreground'>{student ? formatStudentName(student.first_name, student.last_name) : ''} · {student?.grade ?? '—'}</p>
      </div>

      {plan ? (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription><Money usd={plan.total_amount} compact /> total</CardDescription>
            </div>
            <StatusBadge tone={plan.status === 'Active' ? 'info' : plan.status === 'Completed' ? 'good' : 'bad'}>{plan.status}</StatusBadge>
          </CardHeader>
          <CardContent className='divide-y pt-0'>
            {plan.installments.map((inst) => (
              <div key={inst.name} className='flex items-center justify-between py-3'>
                <p className='text-sm font-medium'>Due {inst.due_date}</p>
                <div className='flex items-center gap-3'>
                  <Money usd={inst.amount} compact />
                  <StatusBadge tone={tone[inst.status]}>{inst.status}</StatusBadge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='py-10 text-center text-sm text-muted-foreground'>
            No payment plan on file — the full balance is due at once, or contact the Bursar's office to arrange one.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
