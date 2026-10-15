import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { Money } from '@/components/money'
import { StatusBadge } from '@/components/status-badge'
import { SectionLabel } from '@/components/section-label'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useComprehensiveIncome } from '@/lib/frappe/reports'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'

export const Route = createFileRoute('/_authenticated/bursar/reports/comprehensive-income')({
  component: ComprehensiveIncomePage,
})

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`
}
const todayIso = () => new Date().toISOString().slice(0, 10)

function Line({ label, amountUsd, bold }: { label: string; amountUsd: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <Money usd={amountUsd} />
    </div>
  )
}

function ComprehensiveIncomePage() {
  const [fromDate, setFromDate] = useState(startOfYear)
  const [toDate, setToDate] = useState(todayIso)
  const { data, isLoading, error } = useComprehensiveIncome(fromDate, toDate)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const toUsd = (amountZiG: number) => zigToUsd(amountZiG, zigPerUsd)

  const surplus = data?.surplus_deficit ?? 0

  const reportRows = useMemo(() => {
    if (!data) return []
    const rows: Array<Array<string | number>> = []
    rows.push(['Income', '', ''])
    for (const l of data.income_lines) rows.push(['', `${l.account} (${l.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B'})`, toUsd(l.amount)])
    rows.push(['', 'Total Income', toUsd(data.total_income)])
    rows.push(['Expenditure', '', ''])
    for (const l of data.expense_lines) rows.push(['', `${l.account} (${l.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B'})`, toUsd(l.amount)])
    rows.push(['', 'Total Expenditure', toUsd(data.total_expense)])
    rows.push(['', surplus >= 0 ? 'Surplus for the period' : 'Deficit for the period', toUsd(Math.abs(surplus))])
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, surplus, zigPerUsd])

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Statement of Comprehensive Income</h1>
            <p className='text-sm text-muted-foreground'>Accrual basis, Fund A and Fund B combined.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Input type='date' value={fromDate} onChange={(e) => setFromDate(e.target.value)} className='w-40' />
            <span className='text-muted-foreground'>to</span>
            <Input type='date' value={toDate} onChange={(e) => setToDate(e.target.value)} className='w-40' />
            <ReportActions
              filename={`comprehensive-income-${fromDate}-to-${toDate}`}
              title='Statement of Comprehensive Income'
              meta={`${fromDate} to ${toDate} · Accrual basis, Fund A and Fund B combined (amounts in USD)`}
              header={['Section', 'Account', 'Amount (USD)']}
              rows={reportRows}
              reportKey='income-expenditure'
              reportParams={{ from_date: fromDate, to_date: toDate }}
            />
          </div>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/comprehensive-income' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load this report. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        {data && (
          <>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Card>
                <CardHeader><CardTitle>Total income</CardTitle></CardHeader>
                <CardContent><Money usd={data.total_income_usd ?? toUsd(data.total_income)} className='text-2xl' /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Total expenditure</CardTitle></CardHeader>
                <CardContent><Money usd={data.total_expense_usd ?? toUsd(data.total_expense)} className='text-2xl' /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Surplus / (Deficit)</CardTitle></CardHeader>
                <CardContent className='flex items-center gap-2'>
                  <Money usd={data.surplus_deficit_usd ?? toUsd(Math.abs(surplus))} className='text-2xl' />
                  <StatusBadge tone={surplus >= 0 ? 'good' : 'bad'}>{surplus >= 0 ? 'Surplus' : 'Deficit'}</StatusBadge>
                </CardContent>
              </Card>
            </div>

            <Card className='mt-4'>
              <CardHeader className='border-b'><CardTitle>Statement</CardTitle><CardDescription>Figures in USD.</CardDescription></CardHeader>
              <CardContent className='divide-y pt-2'>
                <div className='py-2'>
                  <SectionLabel>Income</SectionLabel>
                  {data.income_lines.map((l, i) => <Line key={`${l.account}-${i}`} label={`${l.account} (${l.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B'})`} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Total Income' amountUsd={toUsd(data.total_income)} bold />
                </div>
                <div className='py-2'>
                  <SectionLabel>Expenditure</SectionLabel>
                  {data.expense_lines.map((l, i) => <Line key={`${l.account}-${i}`} label={`${l.account} (${l.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B'})`} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Total Expenditure' amountUsd={toUsd(data.total_expense)} bold />
                </div>
                <Line label={surplus >= 0 ? 'Surplus for the period' : 'Deficit for the period'} amountUsd={toUsd(Math.abs(surplus))} bold />
              </CardContent>
            </Card>
          </>
        )}
      </Main>
    </>
  )
}
