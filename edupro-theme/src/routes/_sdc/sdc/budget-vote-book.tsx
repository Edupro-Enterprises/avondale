import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { Money } from '@/components/money'
import { formatZiG } from '@/lib/currency'
import { useAccounts } from '@/lib/frappe/accounts'
import { useBudgetLines } from '@/lib/frappe/budget-lines'

export const Route = createFileRoute('/_sdc/sdc/budget-vote-book')({
  component: SdcBudgetVoteBookPage,
})

function SdcBudgetVoteBookPage() {
  const { data: budgetLines, isLoading, error } = useBudgetLines()
  const { data: accounts } = useAccounts()

  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  function formatBudgetAmount(amount: number, expenseAccount: string) {
    return accountCurrency.get(expenseAccount) === 'USD' ? <Money usd={amount} compact /> : formatZiG(amount)
  }

  const fundBLines = useMemo(() => (budgetLines ?? []).filter((v) => v.fund === 'Fund B - SDC/SDA'), [budgetLines])

  return (
    <>
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Budget Vote Book</h1>
          <p className='text-sm text-muted-foreground'>Fund B only, per SDC oversight.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load budget lines from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        {!isLoading && fundBLines.length === 0 && (
          <p className='text-sm text-muted-foreground'>No Fund B budget lines yet.</p>
        )}

        <div className='grid gap-4 sm:grid-cols-2'>
          {fundBLines.map((line) => (
            <Card key={line.name}>
              <CardHeader>
                <CardTitle>{line.vote_code} — {line.description}</CardTitle>
                <CardDescription>{line.expense_account}{line.is_capital_project === 1 ? ' · Capital project' : ''}</CardDescription>
              </CardHeader>
              <CardContent className='space-y-1 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Approved</span>{formatBudgetAmount(line.approved_budget, line.expense_account)}</div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Committed</span>{formatBudgetAmount(line.committed_amount, line.expense_account)}</div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Spent</span>{formatBudgetAmount(line.actual_spend, line.expense_account)}</div>
                <div className='flex justify-between pt-1 font-medium'><span>Remaining</span>{formatBudgetAmount(line.available_balance, line.expense_account)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
