import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useReceiptsAndPayments } from '@/lib/frappe/reports'
import { formatUSD, zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'

export const Route = createFileRoute('/_authenticated/bursar/reports/cash-flow')({
  component: CashFlowReportPage,
})

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`
}
const todayIso = () => new Date().toISOString().slice(0, 10)

function CashFlowReportPage() {
  const [fromDate, setFromDate] = useState(startOfYear)
  const [toDate, setToDate] = useState(todayIso)
  const { data, isLoading, error } = useReceiptsAndPayments(fromDate, toDate)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const toUsd = (amountZiG: number) => zigToUsd(amountZiG, zigPerUsd)

  const chartData = data ? [{ period: `${data.from_date} — ${data.to_date}`, Receipts: toUsd(data.total_receipts), Payments: toUsd(data.total_payments) }] : []
  const reportRows = useMemo(
    () => (data ? [['Receipts', toUsd(data.total_receipts)], ['Payments', toUsd(data.total_payments)], ['Net Movement', toUsd(data.net_movement)]] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, zigPerUsd]
  )

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Cash Flow</h1>
            <p className='text-sm text-muted-foreground'>Receipts vs. payments for the selected period, in USD.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Input type='date' value={fromDate} onChange={(e) => setFromDate(e.target.value)} className='w-40' />
            <span className='text-muted-foreground'>to</span>
            <Input type='date' value={toDate} onChange={(e) => setToDate(e.target.value)} className='w-40' />
            <ReportActions
              filename={`cash-flow-${fromDate}-to-${toDate}`}
              title='Cash Flow'
              meta={`${fromDate} to ${toDate} · Receipts vs. payments (amounts in USD)`}
              header={['Line', 'Amount (USD)']}
              rows={reportRows}
              reportKey='receipts-and-payments'
              reportParams={{ from_date: fromDate, to_date: toDate }}
            />
          </div>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/cash-flow' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load this report. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        <Card>
          <CardHeader>
            <CardTitle>Receipts vs. Payments</CardTitle>
            <CardDescription>USD, for the selected period</CardDescription>
          </CardHeader>
          <CardContent className='h-72'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
                <XAxis dataKey='period' className='text-xs' />
                <YAxis className='text-xs' tickFormatter={(v) => formatUSD(v)} />
                <Tooltip formatter={(v) => formatUSD(Number(v))} />
                <Bar dataKey='Receipts' fill='var(--chart-1)' radius={4} />
                <Bar dataKey='Payments' fill='var(--chart-3)' radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
