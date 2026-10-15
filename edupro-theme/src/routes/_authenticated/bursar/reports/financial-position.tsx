import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { Money } from '@/components/money'
import { StatusBadge } from '@/components/status-badge'
import { SectionLabel } from '@/components/section-label'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useFinancialPosition } from '@/lib/frappe/reports'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'

export const Route = createFileRoute('/_authenticated/bursar/reports/financial-position')({
  component: FinancialPositionPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

function Line({ label, amountUsd, bold }: { label: string; amountUsd: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <Money usd={amountUsd} />
    </div>
  )
}

function FinancialPositionPage() {
  const [asOfDate, setAsOfDate] = useState(todayIso)
  const { data, isLoading, error } = useFinancialPosition(asOfDate)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const toUsd = (amountZiG: number) => zigToUsd(amountZiG, zigPerUsd)

  const reportRows = useMemo(() => {
    if (!data) return []
    const rows: Array<Array<string | number>> = []
    rows.push(['Assets', '', ''])
    for (const l of data.asset_lines) rows.push(['', l.account, toUsd(l.amount)])
    rows.push(['', 'Total Assets', toUsd(data.total_assets)])
    rows.push(['Liabilities', '', ''])
    for (const l of data.liability_lines) rows.push(['', l.account, toUsd(l.amount)])
    rows.push(['', 'Total Liabilities', toUsd(data.total_liabilities)])
    rows.push(['Equity', '', ''])
    for (const l of data.equity_lines) rows.push(['', l.account, toUsd(l.amount)])
    rows.push(['', 'Unclosed surplus/(deficit)', toUsd(data.unclosed_surplus_deficit)])
    rows.push(['', 'Accumulated Fund', toUsd(data.accumulated_funds)])
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, zigPerUsd])

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Statement of Financial Position</h1>
            <p className='text-sm text-muted-foreground'>Fund A and Fund B combined.</p>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>As at</span>
            <Input type='date' value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className='w-40' />
            <ReportActions
              filename={`financial-position-${asOfDate}`}
              title='Statement of Financial Position'
              meta={`As at ${asOfDate} · Fund A and Fund B combined (amounts in USD)`}
              header={['Section', 'Account', 'Amount (USD)']}
              rows={reportRows}
              reportKey='financial-position'
              reportParams={{ as_of_date: asOfDate }}
            />
          </div>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/financial-position' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load this report. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        {data && (
          <>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Card>
                <CardHeader><CardTitle>Total assets</CardTitle></CardHeader>
                <CardContent><Money usd={data.total_assets_usd ?? zigToUsd(data.total_assets, zigPerUsd)} className='text-2xl' /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Total liabilities</CardTitle></CardHeader>
                <CardContent><Money usd={data.total_liabilities_usd ?? zigToUsd(data.total_liabilities, zigPerUsd)} className='text-2xl' /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Accumulated fund</CardTitle></CardHeader>
                <CardContent><Money usd={data.accumulated_funds_usd ?? zigToUsd(data.accumulated_funds, zigPerUsd)} className='text-2xl' /></CardContent>
              </Card>
            </div>

            {!data.is_balanced && (
              <Card className='mt-4 border-amber-500/50'>
                <CardContent className='py-4 text-sm'>
                  <StatusBadge tone='warning'>Out of balance by <Money usd={toUsd(data.imbalance_amount)} /></StatusBadge>
                </CardContent>
              </Card>
            )}

            <Card className='mt-4'>
              <CardHeader className='border-b'><CardTitle>Statement</CardTitle></CardHeader>
              <CardContent className='divide-y pt-2'>
                <div className='py-2'>
                  <SectionLabel>Assets</SectionLabel>
                  {data.asset_lines.map((l, i) => <Line key={`${l.account}-${i}`} label={l.account} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Total Assets' amountUsd={toUsd(data.total_assets)} bold />
                </div>
                <div className='py-2'>
                  <SectionLabel>Liabilities</SectionLabel>
                  {data.liability_lines.map((l, i) => <Line key={`${l.account}-${i}`} label={l.account} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Total Liabilities' amountUsd={toUsd(data.total_liabilities)} bold />
                </div>
                <div className='py-2'>
                  <SectionLabel>Equity</SectionLabel>
                  {data.equity_lines.map((l, i) => <Line key={`${l.account}-${i}`} label={l.account} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Unclosed surplus/(deficit) for the period' amountUsd={toUsd(data.unclosed_surplus_deficit)} />
                  <Line label='Accumulated Fund' amountUsd={toUsd(data.accumulated_funds)} bold />
                </div>
                <Line label='Total Liabilities + Accumulated Fund' amountUsd={toUsd(data.total_liabilities + data.accumulated_funds)} bold />
              </CardContent>
            </Card>
          </>
        )}
      </Main>
    </>
  )
}
