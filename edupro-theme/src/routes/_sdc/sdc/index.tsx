import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileCheck2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { Money } from '@/components/money'
import { usePaymentVouchers } from '@/lib/frappe/payment-vouchers'
import { useBudgetLines } from '@/lib/frappe/budget-lines'

export const Route = createFileRoute('/_sdc/sdc/')({
  component: SdcDashboard,
})

function SdcDashboard() {
  const { data: vouchers } = usePaymentVouchers()
  const { data: budgetLines } = useBudgetLines()

  const pendingCoApproval = (vouchers ?? []).filter((v) => v.workflow_state === 'Pending SDC Co-Approval' && v.fund === 'Fund B - SDC/SDA')
  const fundBLines = useMemo(() => (budgetLines ?? []).filter((v) => v.fund === 'Fund B - SDC/SDA'), [budgetLines])

  return (
    <>
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>SDC Dashboard</h1>
        </div>

        <Card className='mb-6'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Payment Vouchers awaiting your co-approval</CardTitle>
            <FileCheck2 className='h-4 w-4 text-amber-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold tabular-nums'>{pendingCoApproval.length}</div>
            <p className='text-xs text-muted-foreground'>Fund B (SDC/SDA) only — Fund A is outside SDC's remit.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget vote lines</CardTitle>
            <CardDescription>Fund B only, per SDC oversight.</CardDescription>
          </CardHeader>
          <CardContent className='divide-y'>
            {fundBLines.map((line) => (
              <div key={line.name} className='flex items-center justify-between py-3'>
                <div>
                  <p className='text-sm font-medium'>{line.vote_code} — {line.description}</p>
                  <p className='text-xs text-muted-foreground'>Approved <Money usd={line.approved_budget} compact /></p>
                </div>
                <Money usd={line.available_balance} compact />
              </div>
            ))}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
