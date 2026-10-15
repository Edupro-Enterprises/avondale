import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { useInvoices } from '@/lib/frappe/invoices'
import { useReceipts } from '@/lib/frappe/receipts'
import { useBudgetLines } from '@/lib/frappe/budget-lines'

export const Route = createFileRoute('/_school-head/school-head/reports')({
  component: SchoolHeadReportsPage,
})

function SchoolHeadReportsPage() {
  const { data: invoices } = useInvoices()
  const { data: receipts } = useReceipts()
  const { data: budgetLines } = useBudgetLines()

  const collected = (invoices ?? []).reduce((s, i) => s + (i.total_amount - i.outstanding_amount), 0)
  const outstanding = (invoices ?? []).reduce((s, i) => s + i.outstanding_amount, 0)
  const totalReceipts = (receipts ?? []).reduce((s, r) => s + r.amount, 0)
  const totalCommitted = (budgetLines ?? []).reduce((s, v) => s + v.committed_amount + v.actual_spend, 0)
  const totalApproved = (budgetLines ?? []).reduce((s, v) => s + v.approved_budget, 0)

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Reports</h1>
          <p className='text-sm text-muted-foreground'>Financial summary, year to date.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Card>
            <CardHeader><CardTitle>Collected</CardTitle></CardHeader>
            <CardContent><Money usd={collected} className='text-2xl' /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Outstanding</CardTitle><CardDescription>Across all students</CardDescription></CardHeader>
            <CardContent><Money usd={outstanding} className='text-2xl' /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Receipts posted</CardTitle></CardHeader>
            <CardContent><Money usd={totalReceipts} className='text-2xl' /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Budget committed</CardTitle><CardDescription>of <Money usd={totalApproved} compact /> approved</CardDescription></CardHeader>
            <CardContent><Money usd={totalCommitted} className='text-2xl' /></CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
