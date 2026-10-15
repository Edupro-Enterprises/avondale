import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { StatusBadge } from '@/components/status-badge'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useBudgetLines, type FrappeBudgetLine } from '@/lib/frappe/budget-lines'
import { useAccounts } from '@/lib/frappe/accounts'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import { Money } from '@/components/money'
import type { Fund } from '@/lib/frappe/journal-entries'

export const Route = createFileRoute('/_authenticated/bursar/reports/variance')({
  component: VarianceReportPage,
})

const FUNDS: Fund[] = ['Fund A - General/Government', 'Fund B - SDC/SDA']

function FundSection({
  lines,
  fund,
  amountFor,
  amountUsd,
}: {
  lines: FrappeBudgetLine[]
  fund: Fund
  amountFor: (n: number, account: string) => React.ReactNode
  amountUsd: (n: number, account: string) => number
}) {
  const rows = lines.filter((v) => v.fund === fund)
  const approved = rows.reduce((s, v) => s + amountUsd(v.approved_budget, v.expense_account), 0)
  const actual = rows.reduce((s, v) => s + amountUsd(v.committed_amount + v.actual_spend, v.expense_account), 0)

  return (
    <Card>
      <CardHeader className='border-b'>
        <CardTitle>{fund}</CardTitle>
        <CardDescription>Budget <Money usd={approved} compact /> · Actual <Money usd={actual} compact /></CardDescription>
      </CardHeader>
      <CardContent className='pt-0'>
        <div className='divide-y'>
          {rows.map((v) => {
            const lineActual = v.committed_amount + v.actual_spend
            const lineVariance = v.approved_budget - lineActual
            const favorable = lineVariance >= 0
            return (
              <div key={v.name} className='flex items-center justify-between gap-4 py-3'>
                <div>
                  <p className='text-sm font-medium'>{v.vote_code} — {v.description}</p>
                  <p className='text-xs text-muted-foreground'>
                    {v.expense_account} · Budget {amountFor(v.approved_budget, v.expense_account)} · Committed {amountFor(v.committed_amount, v.expense_account)} · Spent {amountFor(v.actual_spend, v.expense_account)}
                  </p>
                </div>
                <StatusBadge tone={favorable ? 'good' : 'bad'}>
                  {favorable ? 'Favorable' : 'Unfavorable'} · {amountFor(Math.abs(lineVariance), v.expense_account)}
                </StatusBadge>
              </div>
            )
          })}
          {rows.length === 0 && <p className='py-4 text-sm text-muted-foreground'>No budget lines for this fund.</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function VarianceReportPage() {
  const { data: budgetLines, isLoading, error } = useBudgetLines()
  const { data: accounts } = useAccounts()

  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  function amountUsd(amount: number, account: string) {
    return accountCurrency.get(account) === 'USD' ? amount : zigToUsd(amount, zigPerUsd)
  }
  function amountFor(amount: number, account: string) {
    return <Money usd={amountUsd(amount, account)} compact />
  }

  const rows = useMemo(() => budgetLines ?? [], [budgetLines])
  const totalApproved = rows.reduce((s, v) => s + amountUsd(v.approved_budget, v.expense_account), 0)
  const totalActual = rows.reduce((s, v) => s + amountUsd(v.committed_amount + v.actual_spend, v.expense_account), 0)
  const totalVariance = totalApproved - totalActual

  const reportRows = useMemo(
    () =>
      rows.map((v) => {
        const approvedUsd = amountUsd(v.approved_budget, v.expense_account)
        const committedUsd = amountUsd(v.committed_amount, v.expense_account)
        const spentUsd = amountUsd(v.actual_spend, v.expense_account)
        return [v.fund, v.vote_code, v.description, approvedUsd, committedUsd, spentUsd, approvedUsd - committedUsd - spentUsd]
      }),
    [rows, zigPerUsd, accountCurrency]
  )

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Budget Vote Book Variance</h1>
            <p className='text-sm text-muted-foreground'>Every budget line, grouped by fund. Favorable = under budget.</p>
          </div>
          <ReportActions
            filename='budget-variance'
            title='Budget Vote Book Variance'
            meta={`Generated ${new Date().toISOString().slice(0, 10)} · every budget line, grouped by fund (USD)`}
            header={['Fund', 'Vote Code', 'Description', 'Approved Budget (USD)', 'Committed (USD)', 'Actual Spend (USD)', 'Variance (USD)']}
            rows={reportRows}
            reportKey='budget-variance'
          />
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/variance' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load budget lines from the server. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        <div className='mb-4 grid gap-4 sm:grid-cols-3'>
          <Card>
            <CardHeader><CardTitle>Total approved</CardTitle></CardHeader>
            <CardContent className='text-2xl font-bold'><Money usd={totalApproved} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total actual</CardTitle></CardHeader>
            <CardContent className='text-2xl font-bold'><Money usd={totalActual} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total variance</CardTitle></CardHeader>
            <CardContent className='flex items-center gap-2'>
              <span className='text-2xl font-bold'><Money usd={Math.abs(totalVariance)} /></span>
              <StatusBadge tone={totalVariance >= 0 ? 'good' : 'bad'}>{totalVariance >= 0 ? 'Favorable' : 'Unfavorable'}</StatusBadge>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-4'>
          {FUNDS.map((f) => <FundSection key={f} lines={rows} fund={f} amountFor={amountFor} amountUsd={amountUsd} />)}
        </div>
      </Main>
    </>
  )
}
