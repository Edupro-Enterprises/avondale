import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { StatusBadge } from '@/components/status-badge'
import { useMyStudent } from '@/lib/frappe/students'
import { useStudentInvoices, useInvoice, computeFeeStatus } from '@/lib/frappe/invoices'
import { useFeeStructure } from '@/lib/frappe/fee-structures'

export const Route = createFileRoute('/_student/student/statement')({
  component: StudentStatementPage,
})

function StudentStatementPage() {
  const { data: student, isLoading } = useMyStudent()
  const { data: invoices } = useStudentInvoices(student?.name ?? '')
  const latestInvoice = invoices?.[0]
  const { data: invoiceDetail } = useInvoice(latestInvoice?.name)
  const { data: feeStructure } = useFeeStructure(invoiceDetail?.fee_structure)

  if (!isLoading && !student) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-sm text-muted-foreground'>
          Your account isn't linked to a student record yet. Ask your school's office to link it.
        </CardContent>
      </Card>
    )
  }

  const { balanceUSD } = computeFeeStatus(invoices ?? [])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Statement</h1>
        <p className='text-sm text-muted-foreground'>{student?.grade ?? '—'} · {invoiceDetail?.term ?? '—'}</p>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>Outstanding balance</CardTitle>
        </CardHeader>
        <CardContent>
          <Money usd={balanceUSD} className='text-2xl' />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee charges</CardTitle>
          <CardDescription>{feeStructure?.structure_name}</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='divide-y'>
            {(feeStructure?.items ?? []).map((line) => (
              <div key={line.fee_item} className='flex items-center justify-between py-3'>
                <p className='text-sm font-medium'>{line.fee_item}</p>
                {line.currency === 'ZiG' ? <span className='text-sm'>{line.amount.toFixed(2)} ZiG</span> : <Money usd={line.amount} compact />}
              </div>
            ))}
            {!feeStructure && <p className='py-3 text-sm text-muted-foreground'>No invoiced fee structure on file.</p>}
          </div>
        </CardContent>
      </Card>

      <StatusBadge tone='neutral'>
        Payment history is managed by your parent/guardian in the Parent Portal.
      </StatusBadge>
    </div>
  )
}
