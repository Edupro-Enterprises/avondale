import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useTrialBalance } from '@/lib/frappe/reports'

export const Route = createFileRoute('/_authenticated/bursar/reports/ledger')({
  component: LedgerReportPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function LedgerReportPage() {
  const [asOfDate, setAsOfDate] = useState(todayIso)
  const { data, isLoading, error } = useTrialBalance(asOfDate)
  const reportRows = useMemo(
    () => (data?.lines ?? []).map((l) => [l.account, l.account_type, l.currency, fmt(l.native_debit), fmt(l.native_credit), fmt(l.usd_debit ?? 0), fmt(l.usd_credit ?? 0)]),
    [data]
  )

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Ledger (Trial Balance)</h1>
            <p className='text-sm text-muted-foreground'>Per-account debit/credit, in each account's own currency and normalized to USD.</p>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>As at</span>
            <Input type='date' value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className='w-40' />
            <ReportActions
              filename={`ledger-${asOfDate}`}
              title='Ledger (Trial Balance)'
              meta={`As at ${asOfDate} · native currency and normalized to USD`}
              header={['Account', 'Type', 'Currency', 'Debit (native)', 'Credit (native)', 'Debit (USD)', 'Credit (USD)']}
              rows={reportRows}
              reportKey='trial-balance'
              reportParams={{ as_of_date: asOfDate }}
            />
          </div>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/ledger' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load the trial balance from the server. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        {data && (
          <Card>
            <CardHeader>
              <CardTitle>Trial balance</CardTitle>
              <CardDescription>{data.lines.length} accounts with activity · as at {data.as_of_date}</CardDescription>
            </CardHeader>
            <CardContent className='pt-0'>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b text-left text-xs text-muted-foreground'>
                      <th className='py-2 pr-4'>Account</th>
                      <th className='py-2 pr-4'>Type</th>
                      <th className='py-2 pr-4'>Currency</th>
                      <th className='py-2 pr-4 text-right'>Debit (native)</th>
                      <th className='py-2 pr-4 text-right'>Credit (native)</th>
                      <th className='py-2 pr-4 text-right'>Debit (USD)</th>
                      <th className='py-2 text-right'>Credit (USD)</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {data.lines.map((l) => (
                      <tr key={l.account}>
                        <td className='py-2 pr-4'>{l.account}</td>
                        <td className='py-2 pr-4 text-muted-foreground'>{l.account_type}</td>
                        <td className='py-2 pr-4 text-muted-foreground'>{l.currency}</td>
                        <td className='py-2 pr-4 text-right tabular-nums'>{fmt(l.native_debit)}</td>
                        <td className='py-2 pr-4 text-right tabular-nums'>{fmt(l.native_credit)}</td>
                        <td className='py-2 pr-4 text-right tabular-nums'>{fmt(l.usd_debit ?? 0)}</td>
                        <td className='py-2 text-right tabular-nums'>{fmt(l.usd_credit ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className='border-t font-semibold'>
                      <td className='py-2 pr-4' colSpan={5}>Total (USD)</td>
                      <td className='py-2 pr-4 text-right tabular-nums'>{fmt(data.total_usd_debit ?? 0)}</td>
                      <td className='py-2 text-right tabular-nums'>{fmt(data.total_usd_credit ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
