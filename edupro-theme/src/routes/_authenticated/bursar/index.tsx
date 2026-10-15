import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertCircle,
  Banknote,
  BadgeDollarSign,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { NeedsAttentionStrip, type AttentionItem } from '@/components/needs-attention-strip'
import { formatUSD, zigToUsd } from '@/lib/currency'
import { useInvoices } from '@/lib/frappe/invoices'
import { useReceipts } from '@/lib/frappe/receipts'
import { useDebtorCases, useAgeingSummary, type AgeingBucket } from '@/lib/frappe/debtor-cases'
import { useBudgetLines } from '@/lib/frappe/budget-lines'
import { usePaymentVouchers } from '@/lib/frappe/payment-vouchers'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { useTerms } from '@/lib/frappe/terms'
import { useStudents } from '@/lib/frappe/students'
import { useAccounts } from '@/lib/frappe/accounts'
import { useTrialBalance } from '@/lib/frappe/reports'
import type { Fund } from '@/lib/frappe/journal-entries'

export const Route = createFileRoute('/_authenticated/bursar/')({
  component: BursarDashboard,
})

const BUCKETS: AgeingBucket[] = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days']
const bucketColor: Record<AgeingBucket, string> = {
  Current: 'var(--status-good)',
  '1-30 Days': 'var(--status-warning)',
  '31-60 Days': 'var(--status-warning)',
  '61-90 Days': 'var(--status-bad)',
  '90+ Days': 'var(--status-bad)',
}
const FUNDS: Fund[] = ['Fund A - General/Government', 'Fund B - SDC/SDA']

function BursarDashboard() {
  const { data: invoices } = useInvoices()
  const { data: receipts } = useReceipts()
  const { data: debtorCases } = useDebtorCases()
  const { data: budgetLines } = useBudgetLines()
  const { data: paymentVouchers } = usePaymentVouchers()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const { data: terms } = useTerms()
  const { data: students } = useStudents()
  const { data: accounts } = useAccounts()
  const { data: trialBalance } = useTrialBalance()
  const { data: ageingSummary } = useAgeingSummary()

  function receiptAmountUSD(r: { currency: string; amount: number }) {
    return r.currency === 'ZiG' ? zigToUsd(r.amount, zigPerUsd) : r.amount
  }

  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  function amountUsd(amount: number, account: string) {
    return accountCurrency.get(account) === 'USD' ? amount : zigToUsd(amount, zigPerUsd)
  }

  // Current term falls back to the most recently started one if none is
  // explicitly marked -- "this term" should never just silently show zero.
  const currentTerm = useMemo(() => {
    const list = terms ?? []
    return list.find((t) => t.is_current === 1) ?? [...list].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  }, [terms])

  const { billedThisTermUSD, collectedThisTermUSD, completionPct, totalOutstandingUSD } = useMemo(() => {
    const nonCancelled = (invoices ?? []).filter((i) => i.status !== 'Cancelled')
    // A Consolidated invoice's own charge is already re-included in the
    // "Balance Brought Forward" line of whichever later invoice absorbed
    // it -- its own outstanding_amount is correctly 0, so summing it here
    // for the all-time total doesn't double-count anything.
    const outstanding = nonCancelled.reduce((sum, i) => sum + i.outstanding_amount, 0)

    const thisTerm = currentTerm ? nonCancelled.filter((i) => i.term === currentTerm.name && i.status !== 'Consolidated') : []
    const billed = thisTerm.reduce((sum, i) => sum + i.total_amount, 0)
    const collected = thisTerm.reduce((sum, i) => sum + (i.total_amount - i.outstanding_amount), 0)

    return {
      billedThisTermUSD: billed,
      collectedThisTermUSD: collected,
      completionPct: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      totalOutstandingUSD: outstanding,
    }
  }, [invoices, currentTerm])

  const cashAndBankUSD = useMemo(() => {
    if (!trialBalance) return 0
    return trialBalance.lines
      .filter((l) => l.account_type === 'Asset' && (l.account.includes('Bank') || l.account.includes('Cash')))
      .reduce((sum, l) => sum + (l.usd_debit ?? 0) - (l.usd_credit ?? 0), 0)
  }, [trialBalance])

  const totalStudentCount = (students ?? []).length
  const activeStudentCount = (students ?? []).filter((s) => s.status === 'Active').length
  const transferredStudentCount = (students ?? []).filter((s) => s.status === 'Transferred Out').length
  const escalatedCases = (debtorCases ?? []).filter((c) => c.workflow_state === 'Escalated').length
  const overdueAccounts = (debtorCases ?? []).filter((c) => c.workflow_state !== 'Resolved' && c.ageing_bucket !== 'Current')
  const pendingVouchers = (paymentVouchers ?? []).filter(
    (v) => v.workflow_state === 'Pending SDC Co-Approval' || v.workflow_state === 'Pending School Head Approval'
  )

  const collectionsTrend = useMemo(() => {
    const lastSixTerms = [...(terms ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(-6)
    return lastSixTerms.map((t) => ({
      term: t.term_name,
      Collected: (receipts ?? [])
        .filter((r) => r.posting_date >= t.start_date && r.posting_date <= t.end_date)
        .reduce((sum, r) => sum + receiptAmountUSD(r), 0),
    }))
  }, [terms, receipts, zigPerUsd])

  const ageingChartData = useMemo(
    () => BUCKETS.map((bucket) => ({ bucket, outstanding: ageingSummary?.[bucket]?.outstanding_amount ?? 0 })),
    [ageingSummary]
  )

  const enrollmentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of students ?? []) {
      if (s.status !== 'Active') continue
      map.set(s.beneficiary_category, (map.get(s.beneficiary_category) ?? 0) + 1)
    }
    return [...map.entries()].map(([category, count]) => ({ category, count }))
  }, [students])

  const budgetByFund = useMemo(
    () =>
      FUNDS.map((fund) => {
        const lines = (budgetLines ?? []).filter((l) => l.fund === fund)
        return {
          fund: fund.startsWith('Fund A') ? 'Fund A' : 'Fund B',
          Approved: lines.reduce((sum, l) => sum + amountUsd(l.approved_budget, l.expense_account), 0),
          Committed: lines.reduce((sum, l) => sum + amountUsd(l.committed_amount, l.expense_account), 0),
          Spent: lines.reduce((sum, l) => sum + amountUsd(l.actual_spend, l.expense_account), 0),
        }
      }),
    [budgetLines, accountCurrency, zigPerUsd]
  )

  const attentionItems: AttentionItem[] = [
    {
      label: 'overdue accounts',
      count: overdueAccounts.length,
      description: 'Debtor cases past current term, not yet on a payment plan.',
      icon: AlertCircle,
      to: '/bursar/debtors/cases',
      tone: 'bad',
    },
    {
      label: 'vouchers in the approval pipeline',
      count: pendingVouchers.length,
      description: 'Payment vouchers awaiting SDC or School Head sign-off.',
      icon: FileCheck2,
      to: '/bursar/procurement/payment-vouchers',
      tone: 'warning',
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-body font-medium text-primary'>Avondale Primary School</p>
          <h1 className='text-heading-xl font-bold tracking-tight'>Bursar dashboard</h1>
        </div>

        <div className='mb-6 flex flex-wrap gap-2'>
          <Button asChild>
            <Link to='/bursar/billing/batch-invoicing'>
              <FilePlus2 className='h-4 w-4' />
              New invoice
            </Link>
          </Button>
          <Button variant='outline' asChild>
            <Link to='/bursar/payment-desk/receipts'>
              <BadgeDollarSign className='h-4 w-4' />
              Record receipt
            </Link>
          </Button>
        </div>

        <NeedsAttentionStrip items={attentionItems} />

        {/* Cards 1-4: term-level financial summary */}
        <div className='mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Total billed this term</CardTitle>
              <FilePlus2 className='h-4 w-4 text-primary' />
            </CardHeader>
            <CardContent>
              <Money usd={billedThisTermUSD} className='text-heading-lg' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Collected this term</CardTitle>
              <TrendingUp className='h-4 w-4 text-emerald-600' />
            </CardHeader>
            <CardContent>
              <Money usd={collectedThisTermUSD} className='text-heading-lg' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Outstanding balance</CardTitle>
              <Wallet className='h-4 w-4 text-amber-600' />
            </CardHeader>
            <CardContent>
              <Money usd={totalOutstandingUSD} className='text-heading-lg' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Fee collection rate</CardTitle>
              <BadgeDollarSign className='h-4 w-4 text-primary' />
            </CardHeader>
            <CardContent>
              <div className='text-heading-lg font-bold tabular-nums'>{completionPct}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Cards 5-8: at-a-glance operational counts */}
        <div className='mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Cash + bank position</CardTitle>
              <Banknote className='h-4 w-4 text-emerald-600' />
            </CardHeader>
            <CardContent>
              <Money usd={cashAndBankUSD} className='text-heading-lg' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Students</CardTitle>
              <GraduationCap className='h-4 w-4 text-primary' />
            </CardHeader>
            <CardContent>
              <div className='flex items-end justify-between gap-2'>
                <div>
                  <div className='text-heading-lg font-bold tabular-nums'>{activeStudentCount}</div>
                  <div className='text-label text-muted-foreground'>Active</div>
                </div>
                <div className='text-right'>
                  <div className='text-body-lg font-semibold tabular-nums'>{totalStudentCount}</div>
                  <div className='text-label text-muted-foreground'>Total</div>
                </div>
                <Link
                  to='/bursar/students'
                  search={{ enrollmentStatus: 'Transferred Out' }}
                  className='text-right hover:underline'
                  title='View transferred students'
                >
                  <div className='text-body-lg font-semibold tabular-nums'>{transferredStudentCount}</div>
                  <div className='text-label text-muted-foreground'>Transferred</div>
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Escalated debtor cases</CardTitle>
              <AlertCircle className='h-4 w-4 text-red-600' />
            </CardHeader>
            <CardContent>
              <div className='text-heading-lg font-bold tabular-nums'>{escalatedCases}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-body font-medium text-muted-foreground'>Vouchers awaiting approval</CardTitle>
              <FileCheck2 className='h-4 w-4 text-amber-600' />
            </CardHeader>
            <CardContent>
              <div className='text-heading-lg font-bold tabular-nums'>{pendingVouchers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Graphs 9-12 */}
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Collections trend</CardTitle>
              <CardDescription>Last {collectionsTrend.length} terms, USD</CardDescription>
            </CardHeader>
            <CardContent className='h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={collectionsTrend}>
                  <XAxis dataKey='term' className='text-xs' />
                  <YAxis className='text-xs' tickFormatter={(v) => formatUSD(v)} />
                  <Tooltip formatter={(v) => formatUSD(Number(v))} />
                  <Bar dataKey='Collected' fill='var(--chart-1)' radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outstanding by ageing bucket</CardTitle>
              <CardDescription>Open and escalated cases, school-wide</CardDescription>
            </CardHeader>
            <CardContent className='h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={ageingChartData}>
                  <XAxis dataKey='bucket' className='text-xs' />
                  <YAxis className='text-xs' tickFormatter={(v) => formatUSD(v)} />
                  <Tooltip formatter={(v) => formatUSD(Number(v))} />
                  <Bar dataKey='outstanding' name='Outstanding' radius={4}>
                    {ageingChartData.map((row) => <Cell key={row.bucket} fill={bucketColor[row.bucket]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollment by beneficiary category</CardTitle>
              <CardDescription>Active students only</CardDescription>
            </CardHeader>
            <CardContent className='h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={enrollmentByCategory}>
                  <XAxis dataKey='category' className='text-xs' />
                  <YAxis className='text-xs' allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey='count' name='Students' fill='var(--chart-2)' radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget utilization by fund</CardTitle>
              <CardDescription>Approved vs. committed vs. spent, USD</CardDescription>
            </CardHeader>
            <CardContent className='h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={budgetByFund}>
                  <XAxis dataKey='fund' className='text-xs' />
                  <YAxis className='text-xs' tickFormatter={(v) => formatUSD(v)} />
                  <Tooltip formatter={(v) => formatUSD(Number(v))} />
                  <Bar dataKey='Approved' fill='var(--chart-1)' radius={4} />
                  <Bar dataKey='Committed' fill='var(--chart-3)' radius={4} />
                  <Bar dataKey='Spent' fill='var(--chart-4)' radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
