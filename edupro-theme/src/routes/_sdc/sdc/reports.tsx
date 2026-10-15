import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { Money } from '@/components/money'
import { useBudgetLines } from '@/lib/frappe/budget-lines'
import { useJournalEntries, type FrappeJournalEntry, type Fund } from '@/lib/frappe/journal-entries'

export const Route = createFileRoute('/_sdc/sdc/reports')({
  component: SdcReportsPage,
})

function resolvedFund(je: FrappeJournalEntry): Fund {
  return je.fund ?? 'Fund A - General/Government'
}

function SdcReportsPage() {
  const { data: budgetLines } = useBudgetLines()
  const { data: journalEntries } = useJournalEntries()

  const fundBLines = useMemo(() => (budgetLines ?? []).filter((v) => v.fund === 'Fund B - SDC/SDA'), [budgetLines])
  const approved = fundBLines.reduce((s, v) => s + v.approved_budget, 0)
  const spent = fundBLines.reduce((s, v) => s + v.actual_spend, 0)
  const fundBActivity = (journalEntries ?? [])
    .filter((je) => resolvedFund(je) === 'Fund B - SDC/SDA')
    .reduce((s, je) => s + je.total_debit, 0)

  return (
    <>
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Reports</h1>
          <p className='text-sm text-muted-foreground'>Fund B (SDC/SDA) financial summary.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-3'>
          <Card>
            <CardHeader><CardTitle>Approved budget</CardTitle><CardDescription>Fund B</CardDescription></CardHeader>
            <CardContent><Money usd={approved} className='text-2xl' /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Spent</CardTitle></CardHeader>
            <CardContent><Money usd={spent} className='text-2xl' /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ledger activity</CardTitle></CardHeader>
            <CardContent><Money usd={fundBActivity} className='text-2xl' /></CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
