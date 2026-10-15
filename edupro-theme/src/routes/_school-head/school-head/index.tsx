import { createFileRoute } from '@tanstack/react-router'
import { FileCheck2, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { NeedsAttentionStrip, type AttentionItem } from '@/components/needs-attention-strip'
import { usePaymentVouchers } from '@/lib/frappe/payment-vouchers'
import { usePendingReceiptReversals } from '@/lib/frappe/receipts'
import { useBudgetLines } from '@/lib/frappe/budget-lines'

export const Route = createFileRoute('/_school-head/school-head/')({
  component: SchoolHeadDashboard,
})

function SchoolHeadDashboard() {
  const { data: vouchers } = usePaymentVouchers()
  const { data: pendingReversals } = usePendingReceiptReversals()
  const { data: budgetLines } = useBudgetLines()

  const pendingFinal = (vouchers ?? []).filter((v) => v.workflow_state === 'Pending School Head Approval')

  const attentionItems: AttentionItem[] = [
    {
      label: 'vouchers awaiting your final approval',
      count: pendingFinal.length,
      description: 'SDC has already co-approved these — your signature clears them for disbursement.',
      icon: FileCheck2,
      to: '/school-head/payment-vouchers',
      tone: 'warning',
    },
    {
      label: 'receipt reversals pending',
      count: (pendingReversals ?? []).length,
      description: 'Only the School Head can approve a receipt reversal.',
      icon: RotateCcw,
      to: '/school-head/receipt-reversals',
      tone: 'bad',
    },
  ]

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>School Head Dashboard</h1>
        </div>

        <NeedsAttentionStrip items={attentionItems} />

        <Card>
          <CardHeader>
            <CardTitle>Budget lines</CardTitle>
            <CardDescription>Approved budget, committed spend, and what remains available.</CardDescription>
          </CardHeader>
          <CardContent className='divide-y'>
            {(budgetLines ?? []).map((line) => (
              <div key={line.name} className='flex items-center justify-between py-3'>
                <div>
                  <p className='text-sm font-medium'>{line.vote_code} — {line.description}</p>
                  <p className='text-xs text-muted-foreground'>{line.fund}</p>
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
