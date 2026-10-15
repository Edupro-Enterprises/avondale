import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BadgeDollarSign, Eye, ReceiptText, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { RecordPaymentDialog } from '@/components/record-payment-dialog'
import { ReceiptActions } from '@/components/receipt-actions'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { FrappeApiError } from '@/lib/frappe/client'
import { formatStudentName } from '@/lib/utils'
import {
  useReceipts,
  usePaymentMethods,
  usePendingReceiptReversals,
  useRequestReceiptReversal,
  type FrappeReceipt,
  type PaymentMethodType,
} from '@/lib/frappe/receipts'
import { useStudents } from '@/lib/frappe/students'

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/receipts')({
  component: ReceiptsPage,
})

const statusTone: Record<'Posted' | 'Reversal Pending' | 'Reversed', StatusTone> = {
  Posted: 'good',
  'Reversal Pending': 'warning',
  Reversed: 'bad',
}

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'status', label: 'Status', options: ['Posted', 'Reversal Pending', 'Reversed'] },
  { key: 'methodType', label: 'Payment Method', options: ['Cash', 'Bank Transfer', 'EcoCash'] satisfies PaymentMethodType[] },
]

function ReceiptsPage() {
  const { data: receipts, isLoading, error } = useReceipts()
  const { data: students } = useStudents()
  const { data: paymentMethods } = usePaymentMethods()
  const { data: pendingReversals } = usePendingReceiptReversals()
  const requestReversal = useRequestReceiptReversal()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  const filters = useFilters('receipts', FILTER_GROUPS)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [viewing, setViewing] = useState<FrappeReceipt | null>(null)

  const [reversing, setReversing] = useState<FrappeReceipt | null>(null)
  const [reversalReason, setReversalReason] = useState('')

  const studentsByName = useMemo(() => {
    const map = new Map<string, { displayName: string; grade?: string }>()
    for (const s of students ?? []) map.set(s.name, { displayName: formatStudentName(s.first_name, s.last_name), grade: s.grade })
    return map
  }, [students])

  const methodTypeByName = useMemo(() => {
    const map = new Map<string, PaymentMethodType>()
    for (const pm of paymentMethods ?? []) map.set(pm.name, pm.method_type)
    return map
  }, [paymentMethods])

  const pendingReversalOf = useMemo(
    () => new Set((pendingReversals ?? []).map((r) => r.reversal_of)),
    [pendingReversals]
  )

  function receiptStatus(r: FrappeReceipt): 'Posted' | 'Reversal Pending' | 'Reversed' {
    if (r.status === 'Reversed') return 'Reversed'
    if (pendingReversalOf.has(r.name)) return 'Reversal Pending'
    return 'Posted'
  }

  const rows = receipts ?? []

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((r) => {
      const studentName = studentsByName.get(r.student)?.displayName ?? r.student
      const matchesSearch =
        !search ||
        studentName.toLowerCase().includes(search) ||
        r.name.toLowerCase().includes(search) ||
        (r.external_reference ?? '').toLowerCase().includes(search)
      const matchesStatus = !filters.values.status || receiptStatus(r) === filters.values.status
      const matchesMethod = !filters.values.methodType || methodTypeByName.get(r.payment_method) === filters.values.methodType
      const matchesFrom = !fromDate || r.posting_date >= fromDate
      const matchesTo = !toDate || r.posting_date <= toDate
      return matchesSearch && matchesStatus && matchesMethod && matchesFrom && matchesTo
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, studentsByName, methodTypeByName, filters.search, filters.values, pendingReversalOf, fromDate, toDate])

  function amountToUSD(r: FrappeReceipt) {
    return r.currency === 'ZiG' ? zigToUsd(r.amount, zigPerUsd) : r.amount
  }

  function toReceiptPdfData(r: FrappeReceipt) {
    const student = studentsByName.get(r.student)
    return {
      receiptNumber: r.name,
      integrityHash: r.integrity_hash,
      postingDate: r.posting_date,
      studentName: student?.displayName ?? r.student,
      studentId: r.student,
      studentClass: student?.grade,
      amount: r.amount,
      currency: r.currency,
      paymentMethod: r.payment_method,
      externalReference: r.external_reference,
      receivedBy: r.received_by,
    }
  }

  const columns: DataListColumn<FrappeReceipt>[] = [
    {
      id: 'student',
      header: 'Student',
      sortable: true,
      sortValue: (r) => studentsByName.get(r.student)?.displayName ?? r.student,
      className: 'min-w-32',
      cell: (r) => studentsByName.get(r.student)?.displayName ?? r.student,
    },
    { id: 'id', header: 'Receipt ID', sortable: true, sortValue: (r) => r.name, cell: (r) => r.name },
    { id: 'reference', header: 'Reference', sortable: true, sortValue: (r) => r.external_reference ?? '', cell: (r) => r.external_reference || '—' },
    {
      id: 'method',
      header: 'Method',
      sortable: true,
      sortValue: (r) => r.payment_method,
      cell: (r) => (r.currency === 'ZiG' ? `${r.payment_method} · ZiG ${r.amount.toLocaleString()}` : r.payment_method),
    },
    { id: 'date', header: 'Date', sortable: true, sortValue: (r) => r.posting_date, cell: (r) => r.posting_date },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (r) => amountToUSD(r),
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (r) => <Money usd={amountToUSD(r)} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => receiptStatus(r),
      cell: (r) => <StatusBadge tone={statusTone[receiptStatus(r)]}>{receiptStatus(r)}</StatusBadge>,
    },
    {
      id: 'actions',
      header: '',
      className: 'w-16',
      cell: (r) => (
        <div className='flex items-center justify-end gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='h-7! w-7!'
            onClick={(e) => { e.stopPropagation(); setViewing(r) }}
            title='View / reprint'
            aria-label={`View receipt ${r.name}`}
          >
            <Eye className='h-4 w-4' />
          </Button>
          {receiptStatus(r) === 'Posted' && (
            <Button
              variant='ghost'
              size='icon'
              className='h-7! w-7!'
              onClick={(e) => { e.stopPropagation(); setReversing(r) }}
              title='Request reversal'
              aria-label={`Request reversal for ${r.name}`}
            >
              <RotateCcw className='h-4 w-4' />
            </Button>
          )}
        </div>
      ),
    },
  ]

  async function submitReversal() {
    if (!reversing || !reversalReason.trim()) return
    try {
      await requestReversal.mutateAsync({ receipt: reversing.name, reason: reversalReason.trim() })
      toast.info(`Reversal requested for ${reversing.name}, awaiting School Head approval`)
      setReversing(null)
      setReversalReason('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not request this reversal.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Payment Desk</p>
            <h1 className='text-3xl font-bold tracking-tight'>Payment History</h1>
          </div>
          <Button onClick={() => setPayOpen(true)}>
            <BadgeDollarSign className='h-4 w-4' />
            Record payment
          </Button>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load receipts from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All receipts</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Input type='date' value={fromDate} onChange={(e) => setFromDate(e.target.value)} className='w-36' aria-label='From date' />
                <span className='text-sm text-muted-foreground'>to</span>
                <Input type='date' value={toDate} onChange={(e) => setToDate(e.target.value)} className='w-36' aria-label='To date' />
                <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by receipt no., student, or reference…' />
              </div>
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(r) => r.name}
              isLoading={isLoading}
              densityStorageKey='receipts'
              emptyState={{
                icon: ReceiptText,
                title: 'No receipts found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Receipts will appear here once issued.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <RecordPaymentDialog key={String(payOpen)} open={payOpen} onOpenChange={setPayOpen} />

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{viewing?.name}</DialogTitle>
              <DialogDescription>Payment details and receipt reprint.</DialogDescription>
            </DialogHeader>
            {viewing && (
              <div className='grid gap-4'>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div><p className='text-xs text-muted-foreground'>Student</p><p>{studentsByName.get(viewing.student)?.displayName ?? viewing.student}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Date</p><p>{viewing.posting_date}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Amount</p><p><Money usd={amountToUSD(viewing)} /></p></div>
                  <div><p className='text-xs text-muted-foreground'>Method</p><p>{viewing.payment_method}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Reference</p><p>{viewing.external_reference || '—'}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Status</p><p><StatusBadge tone={statusTone[receiptStatus(viewing)]}>{receiptStatus(viewing)}</StatusBadge></p></div>
                </div>
                <ReceiptActions receipt={toReceiptPdfData(viewing)} size='sm' />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!reversing} onOpenChange={(o) => { if (!o) { setReversing(null); setReversalReason('') } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request reversal for {reversing?.name}</DialogTitle>
              <DialogDescription>Sent to the School Head for approval.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-2 py-2'>
              <Label htmlFor='reason'>Reason</Label>
              <Textarea id='reason' rows={3} value={reversalReason} onChange={(e) => setReversalReason(e.target.value)} placeholder='Why does this receipt need to be reversed?' />
            </div>
            <DialogFooter>
              <Button disabled={!reversalReason.trim() || requestReversal.isPending} onClick={submitReversal}>
                {requestReversal.isPending ? 'Submitting…' : 'Submit request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
