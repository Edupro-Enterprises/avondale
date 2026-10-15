import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { ReportActions } from '@/components/report-actions'
import { useBankNameByAccount } from '@/lib/frappe/school-setup'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import { useCashBook } from '@/lib/frappe/reports'

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/cash-book')({
  component: CashBookPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)
const monthAgoIso = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function CashBookPage() {
  const [account, setAccount] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate] = useState(monthAgoIso)
  const [toDate, setToDate] = useState(todayIso)
  const { data, isLoading, error } = useCashBook(account, fromDate, toDate)
  const bankNameByAccount = useBankNameByAccount()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  const activeAccount = data?.account
  const toUsd = (amount: number) => zigToUsd(amount, zigPerUsd)
  const label = (acc: string) => bankNameByAccount.get(acc) ?? acc

  const reportRows = useMemo(
    () =>
      (data?.lines ?? []).map((l) => [
        l.posting_date, l.voucher_no, l.reference_doctype ?? '', l.description ?? '',
        l.debit ? String(l.debit) : '', l.credit ? String(l.credit) : '', String(l.balance),
      ]),
    [data]
  )

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Payments</p>
            <h1 className='text-3xl font-bold tracking-tight'>Cash Book</h1>
            <p className='text-sm text-muted-foreground'>Running balance for a Cash-in-Till or Bank account.</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Select value={activeAccount ?? ''} onValueChange={setAccount}>
              <SelectTrigger className='w-56'><SelectValue placeholder='Select account' /></SelectTrigger>
              <SelectContent>
                {(data?.accounts ?? []).map((acc) => <SelectItem key={acc} value={acc}>{label(acc)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type='date' value={fromDate} onChange={(e) => setFromDate(e.target.value)} className='w-40' />
            <span className='text-sm text-muted-foreground'>to</span>
            <Input type='date' value={toDate} onChange={(e) => setToDate(e.target.value)} className='w-40' />
            {data && (
              <ReportActions
                filename={`cash-book-${activeAccount}-${fromDate}-to-${toDate}`}
                title={`Cash Book — ${label(activeAccount ?? '')}`}
                meta={`${fromDate} to ${toDate}`}
                header={['Date', 'Voucher', 'Source', 'Description', 'Debit', 'Credit', 'Balance']}
                rows={reportRows}
                reportKey='cashbook'
                reportParams={{ account, from_date: fromDate, to_date: toDate }}
              />
            )}
          </div>
        </div>

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load the cash book from the server. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        {data && !data.account && (
          <Card><CardContent className='py-4 text-sm text-muted-foreground'>No cash/bank accounts are configured yet — add one under Settings &gt; School Setup &gt; Bank Accounts.</CardContent></Card>
        )}

        {data && data.account && (
          <>
            <div className='mb-4 grid gap-4 sm:grid-cols-2'>
              <Card>
                <CardHeader className='pb-2'><CardDescription>Opening balance</CardDescription></CardHeader>
                <CardContent><Money usd={toUsd(data.opening_balance)} className='text-2xl font-bold' /></CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'><CardDescription>Closing balance</CardDescription></CardHeader>
                <CardContent><Money usd={toUsd(data.closing_balance)} className='text-2xl font-bold' /></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{label(data.account)}</CardTitle>
                <CardDescription>{data.lines.length} transactions</CardDescription>
              </CardHeader>
              <CardContent className='pt-0'>
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='border-b text-left text-xs text-muted-foreground'>
                        <th className='py-2 pr-4'>Date</th>
                        <th className='py-2 pr-4'>Voucher</th>
                        <th className='py-2 pr-4'>Source</th>
                        <th className='py-2 pr-4'>Description</th>
                        <th className='py-2 pr-4 text-right'>Debit</th>
                        <th className='py-2 pr-4 text-right'>Credit</th>
                        <th className='py-2 text-right'>Balance</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y'>
                      <tr>
                        <td className='py-2 pr-4 text-muted-foreground' colSpan={6}>Opening balance</td>
                        <td className='py-2 text-right tabular-nums'><Money usd={toUsd(data.opening_balance)} /></td>
                      </tr>
                      {data.lines.map((l) => (
                        <tr key={`${l.voucher_no}-${l.posting_date}-${l.debit}-${l.credit}`}>
                          <td className='py-2 pr-4'>{l.posting_date}</td>
                          <td className='py-2 pr-4'>{l.voucher_no}</td>
                          <td className='py-2 pr-4 text-muted-foreground'>{l.reference_doctype ?? '—'}</td>
                          <td className='py-2 pr-4 text-muted-foreground'>{l.description ?? '—'}</td>
                          <td className='py-2 pr-4 text-right tabular-nums'>{l.debit ? <Money usd={toUsd(l.debit)} /> : '—'}</td>
                          <td className='py-2 pr-4 text-right tabular-nums'>{l.credit ? <Money usd={toUsd(l.credit)} /> : '—'}</td>
                          <td className='py-2 text-right tabular-nums'><Money usd={toUsd(l.balance)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.lines.length === 0 && (
                    <p className='py-6 text-center text-sm text-muted-foreground'>No transactions in this date range.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </Main>
    </>
  )
}
