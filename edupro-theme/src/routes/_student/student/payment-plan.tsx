import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { useMyStudent } from '@/lib/frappe/students'
import { useStudentPaymentPlan } from '@/lib/frappe/payment-plans'

export const Route = createFileRoute('/_student/student/payment-plan')({
  component: StudentPaymentPlanPage,
})

const tone: Record<string, StatusTone> = { Paid: 'good', Pending: 'neutral', Overdue: 'bad' }

function StudentPaymentPlanPage() {
  const { data: student, isLoading } = useMyStudent()
  const { data: plan } = useStudentPaymentPlan(student?.name)

  if (!isLoading && !student) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-sm text-muted-foreground'>
          Your account isn't linked to a student record yet. Ask your school's office to link it.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Payment Plan</h1>
        <p className='text-sm text-muted-foreground'>{student?.grade ?? '—'}</p>
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
            No payment plan on file for this term.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
