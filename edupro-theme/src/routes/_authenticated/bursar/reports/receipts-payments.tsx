import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { Money } from '@/components/money'
import { SectionLabel } from '@/components/section-label'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useReceiptsAndPayments } from '@/lib/frappe/reports'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'

export const Route = createFileRoute('/_authenticated/bursar/reports/receipts-payments')({
  component: ReceiptsPaymentsReportPage,
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

function ReceiptsPaymentsReportPage() {
  const [fromDate, setFromDate] = useState(startOfYear)
  const [toDate, setToDate] = useState(todayIso)
  const { data, isLoading, error } = useReceiptsAndPayments(fromDate, toDate)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const toUsd = (amountZiG: number) => zigToUsd(amountZiG, zigPerUsd)

  const reportRows = useMemo(() => {
    if (!data) return []
    const rows: Array<Array<string | number>> = []
    rows.push(['Receipts', '', ''])
    for (const l of data.receipt_lines) rows.push(['', l.source, toUsd(l.amount)])
    rows.push(['', 'Total Receipts', toUsd(data.total_receipts)])
    rows.push(['Payments', '', ''])
    for (const l of data.payment_lines) rows.push(['', l.source, toUsd(l.amount)])
    rows.push(['', 'Total Payments', toUsd(data.total_payments)])
    rows.push(['', 'Net Movement', toUsd(data.net_movement)])
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
            <h1 className='text-3xl font-bold tracking-tight'>Statement of Receipts &amp; Payments</h1>
            <p className='text-sm text-muted-foreground'>Cash basis, in USD.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Input type='date' value={fromDate} onChange={(e) => setFromDate(e.target.value)} className='w-40' />
            <span className='text-muted-foreground'>to</span>
            <Input type='date' value={toDate} onChange={(e) => setToDate(e.target.value)} className='w-40' />
            <ReportActions
              filename={`receipts-payments-${fromDate}-to-${toDate}`}
              title='Statement of Receipts & Payments'
              meta={`${fromDate} to ${toDate} · Cash basis (amounts in USD)`}
              header={['Section', 'Source', 'Amount (USD)']}
              rows={reportRows}
              reportKey='receipts-and-payments'
              reportParams={{ from_date: fromDate, to_date: toDate }}
            />
          </div>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/receipts-payments' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load this report. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        {data && (
          <>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Card>
                <CardHeader><CardTitle>Total receipts</CardTitle><CardDescription>{data.from_date} to {data.to_date}</CardDescription></CardHeader>
                <CardContent><Money usd={data.total_receipts_usd ?? toUsd(data.total_receipts)} className='text-2xl' /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Total payments</CardTitle></CardHeader>
                <CardContent><Money usd={data.total_payments_usd ?? toUsd(data.total_payments)} className='text-2xl' /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Net movement</CardTitle></CardHeader>
                <CardContent><Money usd={data.net_movement_usd ?? toUsd(data.net_movement)} className='text-2xl' /></CardContent>
              </Card>
            </div>

            <Card className='mt-4'>
              <CardHeader className='border-b'>
                <CardTitle>Statement</CardTitle>
                <CardDescription>Figures in USD.</CardDescription>
              </CardHeader>
              <CardContent className='divide-y pt-2'>
                <div className='py-2'>
                  <SectionLabel>Receipts</SectionLabel>
                  {data.receipt_lines.map((l) => <Line key={l.source} label={l.source} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Total Receipts' amountUsd={toUsd(data.total_receipts)} bold />
                </div>
                <div className='py-2'>
                  <SectionLabel>Payments</SectionLabel>
                  {data.payment_lines.map((l) => <Line key={l.source} label={l.source} amountUsd={toUsd(l.amount)} />)}
                  <Line label='Total Payments' amountUsd={toUsd(data.total_payments)} bold />
                </div>
                <Line label='Net Movement' amountUsd={toUsd(data.net_movement)} bold />
              </CardContent>
            </Card>
          </>
        )}
      </Main>
    </>
  )
}
