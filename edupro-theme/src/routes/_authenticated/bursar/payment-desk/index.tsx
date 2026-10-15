import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { BadgeDollarSign, FileText, GraduationCap, Search, UserRound, UserSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { RecordPaymentDialog } from '@/components/record-payment-dialog'
import { StudentDocumentActions } from '@/components/student-document-actions'
import { buildStatementSections } from '@/lib/student-documents'
import { formatUSD, zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { useSchoolSetup } from '@/lib/frappe/school-setup'
import { useStudents } from '@/lib/frappe/students'
import { useStudentInvoices, computeFeeStatus } from '@/lib/frappe/invoices'
import { useStudentReceipts } from '@/lib/frappe/receipts'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/')({
  validateSearch: z.object({ student: z.string().optional() }),
  component: PaymentDeskLookupPage,
})

function PaymentDeskLookupPage() {
  const { student: studentId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState('')
  const [payOpen, setPayOpen] = useState(false)

  const { data: students, isLoading } = useStudents()

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (students ?? [])
      .filter((s) => formatStudentName(s.first_name, s.last_name).toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 15)
  }, [students, query])

  const selected = (students ?? []).find((s) => s.name === studentId)

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Payment Desk</p>
          <h1 className='text-3xl font-bold tracking-tight'>Student Lookup</h1>
          <p className='text-sm text-muted-foreground'>Search a student to see their account and record a payment.</p>
        </div>

        <Card className='mb-6'>
          <CardContent className='pt-6'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                autoFocus
                className='pl-9'
                placeholder='Search by name or student number…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {query && (
              <div className='mt-3 divide-y rounded-md border'>
                {isLoading && <p className='px-3 py-3 text-sm text-muted-foreground'>Searching…</p>}
                {!isLoading && matches.length === 0 && (
                  <p className='px-3 py-3 text-sm text-muted-foreground'>No students match "{query}".</p>
                )}
                {matches.map((s) => (
                  <button
                    key={s.name}
                    className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50'
                    onClick={() => { navigate({ search: { student: s.name } }); setQuery('') }}
                  >
                    <span className='flex items-center gap-2'>
                      <GraduationCap className='h-3.5 w-3.5 text-primary' />
                      {formatStudentName(s.first_name, s.last_name)}
                    </span>
                    <span className='text-xs text-muted-foreground'>{s.name} · {s.grade ?? 'No grade'}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!selected && !query && (
          <Card>
            <CardContent className='flex flex-col items-center gap-2 py-16 text-center text-muted-foreground'>
              <UserSearch className='h-8 w-8' />
              <p className='text-sm'>Search for a student above to see their account overview.</p>
            </CardContent>
          </Card>
        )}

        {selected && <AccountOverview studentId={selected.name} onRecordPayment={() => setPayOpen(true)} />}
      </Main>

      {selected && <RecordPaymentDialog key={`${selected.name}-${payOpen}`} open={payOpen} onOpenChange={setPayOpen} studentId={selected.name} />}
    </>
  )
}

function AccountOverview({ studentId, onRecordPayment }: { studentId: string; onRecordPayment: () => void }) {
  const { data: students } = useStudents()
  const { data: invoices, isLoading: invoicesLoading } = useStudentInvoices(studentId)
  const { data: receipts, isLoading: receiptsLoading } = useStudentReceipts(studentId)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const { data: schoolSetup } = useSchoolSetup()
  const [statementOpen, setStatementOpen] = useState(false)

  const student = (students ?? []).find((s) => s.name === studentId)
  const { balanceUSD } = computeFeeStatus(invoices ?? [])
  // A Consolidated invoice's total is already re-stated as a "Balance
  // brought forward" line on the invoice that absorbed it -- summing it
  // here too would double/triple-count the same debt (see student-documents.ts).
  const totalFees = (invoices ?? [])
    .filter((inv) => inv.status !== 'Consolidated')
    .reduce((sum, inv) => sum + inv.total_amount, 0)
  const totalPaid = totalFees - balanceUSD

  function receiptAmountUSD(r: { currency: string; amount: number }) {
    return r.currency === 'ZiG' ? zigToUsd(r.amount, zigPerUsd) : r.amount
  }

  const statement = useMemo(
    () => buildStatementSections(invoices ?? [], receipts ?? [], receiptAmountUSD, schoolSetup?.banking_configuration),
    [invoices, receipts, schoolSetup?.banking_configuration, zigPerUsd]
  )

  if (!student) return null

  const displayName = formatStudentName(student.first_name, student.last_name)

  return (
    <div className='grid gap-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 border-b'>
          <div>
            <CardTitle>{displayName}</CardTitle>
            <CardDescription>{student.name} · {student.grade ?? 'No grade set'}</CardDescription>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' asChild>
              <Link to='/bursar/students/$studentId' params={{ studentId: student.name }} search={{ tab: undefined }}>
                <UserRound className='h-4 w-4' />
                View profile
              </Link>
            </Button>
            <Button variant='outline' onClick={() => setStatementOpen(true)}>
              <FileText className='h-4 w-4' />
              Generate statement
            </Button>
            <Button onClick={onRecordPayment}>
              <BadgeDollarSign className='h-4 w-4' />
              Record payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className='grid gap-4 pt-4 sm:grid-cols-3'>
          <div>
            <p className='text-xs text-muted-foreground'>Total fees</p>
            <p className='text-xl font-bold'><Money usd={totalFees} /></p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Payments made</p>
            <p className='text-xl font-bold'><Money usd={totalPaid} /></p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Outstanding balance</p>
            <p className={`text-xl font-bold ${balanceUSD > 0 ? 'text-destructive' : ''}`}><Money usd={balanceUSD} /></p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='border-b'>
          <CardTitle>Recent payment history</CardTitle>
          <CardDescription>{(receipts ?? []).length} receipts on record</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          {(invoicesLoading || receiptsLoading) && <p className='py-4 text-sm text-muted-foreground'>Loading…</p>}
          {!receiptsLoading && (receipts ?? []).length === 0 && (
            <p className='py-4 text-sm text-muted-foreground'>No payments recorded yet.</p>
          )}
          <div className='divide-y'>
            {(receipts ?? []).slice(0, 8).map((r) => (
              <div key={r.name} className='flex items-center justify-between py-3 text-sm'>
                <div>
                  <p className='font-medium'>{r.name}</p>
                  <p className='text-xs text-muted-foreground'>{r.posting_date} · {r.payment_method}</p>
                </div>
                <Money usd={receiptAmountUSD(r)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Statement -- {displayName}</DialogTitle>
            <DialogDescription>{student.name} · {(invoices ?? []).length} invoices · {(receipts ?? []).length} receipts</DialogDescription>
          </DialogHeader>
          <StudentDocumentActions
            kind='statement'
            studentId={student.name}
            studentName={displayName}
            sections={statement.sections}
            summary={{ label: 'Total Balance', value: formatUSD(statement.totalBalanceUSD) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
