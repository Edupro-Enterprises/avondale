import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useBankReconciliations, type FrappeBankReconciliation } from '@/lib/frappe/bank-reconciliations'
import { useAccounts } from '@/lib/frappe/accounts'
import { useBankNameByAccount } from '@/lib/frappe/school-setup'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'

export const Route = createFileRoute('/_authenticated/bursar/reports/bank-reconciliation')({
  component: BankReconciliationReportPage,
})

const stateTone: Record<FrappeBankReconciliation['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending Head Sign-Off': 'warning',
  Reconciled: 'good',
  'Discrepancy Flagged': 'bad',
}

function BankReconciliationReportPage() {
  const { data: reconciliations, isLoading, error } = useBankReconciliations()
  const { data: accounts } = useAccounts()
  const bankNameByAccount = useBankNameByAccount()
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
    return <Money usd={amountUsd(amount, account)} />
  }
  function bankLabel(account: string) {
    return bankNameByAccount.get(account) ?? account
  }
  const rows = useMemo(() => reconciliations ?? [], [reconciliations])
  const reportRows = useMemo(
    () =>
      rows.map((r) => [
        bankLabel(r.bank_account),
        r.period_end,
        amountUsd(r.balance_per_statement, r.bank_account),
        amountUsd(r.balance_per_cashbook, r.bank_account),
        amountUsd(r.reconciled_balance, r.bank_account),
        amountUsd(r.variance, r.bank_account),
        r.workflow_state,
      ]),
    [rows, zigPerUsd, accountCurrency, bankNameByAccount]
  )

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Bank Reconciliation Report</h1>
            <p className='text-sm text-muted-foreground'>Read-only rollup of every account's reconciliations -- see Finance → Bank Reconciliation to work a new one.</p>
          </div>
          <ReportActions
            filename='bank-reconciliation'
            title='Bank Reconciliation Report'
            meta={`Generated ${new Date().toISOString().slice(0, 10)} · rollup of every account's reconciliations`}
            header={['Bank Account', 'Period End', 'Statement Balance', 'Cashbook Balance', 'Reconciled Balance', 'Variance', 'Status']}
            rows={reportRows}
            reportKey='bank-reconciliation'
          />
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/bank-reconciliation' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load bank reconciliations from the server. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
        {!isLoading && rows.length === 0 && <p className='text-sm text-muted-foreground'>No reconciliations on record yet.</p>}

        <div className='grid gap-4'>
          {rows.map((rec) => (
            <Card key={rec.name}>
              <CardHeader className='border-b'>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle>{bankLabel(rec.bank_account)}</CardTitle>
                    <CardDescription>Period end {rec.period_end}</CardDescription>
                  </div>
                  <StatusBadge tone={stateTone[rec.workflow_state]}>{rec.workflow_state}</StatusBadge>
                </div>
              </CardHeader>
              <CardContent className='space-y-2 pt-4 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Statement balance</span>{amountFor(rec.balance_per_statement, rec.bank_account)}</div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Cashbook balance</span>{amountFor(rec.balance_per_cashbook, rec.bank_account)}</div>
                <div className='flex justify-between border-t pt-2 font-medium'><span>Reconciled balance</span>{amountFor(rec.reconciled_balance, rec.bank_account)}</div>
                <div className='flex items-center justify-between'>
                  <span className='font-medium'>Variance</span>
                  <StatusBadge tone={rec.variance === 0 ? 'good' : 'warning'}>{rec.variance === 0 ? 'Balanced' : `${rec.variance > 0 ? '+' : ''}${rec.variance.toFixed(2)}`}</StatusBadge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
