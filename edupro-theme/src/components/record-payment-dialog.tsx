import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Coins,
  DollarSign,
  GraduationCap,
  Hash,
  Landmark,
  ListChecks,
  Search,
  Smartphone,
  StickyNote,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Money } from '@/components/money'
import { ReceiptActions } from '@/components/receipt-actions'
import { SectionLabel } from '@/components/section-label'
import { cn, formatStudentName } from '@/lib/utils'
import { zigToUsd, usdToZig } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { FrappeApiError } from '@/lib/frappe/client'
import { useStudents, type FrappeStudent } from '@/lib/frappe/students'
import { useClassStreams } from '@/lib/frappe/class-streams'
import { useStudentInvoices } from '@/lib/frappe/invoices'
import {
  usePaymentMethods,
  useCreateReceipt,
  useInvoiceLineBalances,
  type PaymentMethodType,
} from '@/lib/frappe/receipts'

const METHOD_TYPES: { type: PaymentMethodType; icon: React.ElementType }[] = [
  { type: 'Cash', icon: Wallet },
  { type: 'Bank Transfer', icon: Landmark },
  { type: 'EcoCash', icon: Smartphone },
]

const todayIso = () => new Date().toISOString().slice(0, 10)

function FieldLabel({ icon: Icon, children, htmlFor }: { icon: React.ElementType; children: React.ReactNode; htmlFor: string }) {
  return (
    <Label htmlFor={htmlFor} className='flex items-center gap-1.5 text-muted-foreground'>
      <Icon className='h-3.5 w-3.5' />
      {children}
    </Label>
  )
}

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selects a student (e.g. from the Payment Desk lookup screen) and
   * hides the student picker. Omit to let the cashier pick anyone. */
  studentId?: string
}

/** Fields reset only at mount -- callers must pass a `key` that changes on
 * open (e.g. `key={String(open)}`) to get a fresh form each time, instead of
 * syncing via effect (same pattern as StudentFormDialog). */

export function RecordPaymentDialog({ open, onOpenChange, studentId }: RecordPaymentDialogProps) {
  const { data: students } = useStudents()
  const { data: classStreams } = useClassStreams()
  const { data: paymentMethods } = usePaymentMethods()
  const createReceipt = useCreateReceipt()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  const [student, setStudent] = useState(studentId ?? '')
  const [studentQuery, setStudentQuery] = useState('')
  const [studentClassFilter, setStudentClassFilter] = useState<string>('')
  const [invoice, setInvoice] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'USD' | 'ZiG'>('USD')
  const [methodType, setMethodType] = useState<PaymentMethodType>('Cash')
  const [bankMethod, setBankMethod] = useState('')
  const [postingDate, setPostingDate] = useState(todayIso)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [posted, setPosted] = useState<{ name: string; integrityHash?: string; amount: number; method: string } | null>(null)

  const { data: studentInvoices } = useStudentInvoices(student)
  const openInvoices = (studentInvoices ?? []).filter((inv) => inv.outstanding_amount > 0)
  const { data: lineBalances } = useInvoiceLineBalances(invoice || undefined)

  const studentNames = useMemo(() => {
    const map = new Map<string, FrappeStudent>()
    for (const s of students ?? []) map.set(s.name, s)
    return map
  }, [students])

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    return (students ?? [])
      .filter((s) => !studentClassFilter || s.grade === studentClassFilter)
      .filter((s) => !q || formatStudentName(s.first_name, s.last_name).toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 20)
  }, [students, studentQuery, studentClassFilter])

  const eligibleMethods = useMemo(
    () => (paymentMethods ?? []).filter((pm) => pm.method_type === methodType && pm.currency === currency),
    [paymentMethods, methodType, currency]
  )
  const resolvedMethod =
    methodType === 'Bank Transfer' ? eligibleMethods.find((pm) => pm.name === bankMethod) : eligibleMethods[0]

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0)
  const unallocated = (Number(amount) || 0) - allocatedTotal
  const isBalanced = Math.abs(unallocated) <= 0.01

  /** newAmount and every value this writes into `allocations` are in the
   * receipt's own currency (`currency`) -- _validate_allocations on the
   * backend requires allocations to sum to exactly `self.amount`. Each
   * line's own `outstanding` is in that fee item's currency (Invoice
   * Line.currency), which can differ from the receipt's, so it's converted
   * before being compared/filled. Confirmed real gap: without this
   * conversion, a ZiG receipt's allocation boxes were auto-filled by
   * comparing raw ZiG numbers against USD-denominated line balances, so
   * "Unallocated" could never reach zero. */
  function resetAllocationsFor(newAmount: number, receiptCurrency: 'USD' | 'ZiG' = currency) {
    if (!lineBalances) return
    const next: Record<string, string> = {}
    let remaining = newAmount
    for (const line of lineBalances) {
      if (remaining <= 0) break
      const outstandingInReceiptCurrency =
        line.currency === receiptCurrency
          ? line.outstanding
          : receiptCurrency === 'USD'
            ? zigToUsd(line.outstanding, zigPerUsd)
            : usdToZig(line.outstanding, zigPerUsd)
      const take = Math.min(outstandingInReceiptCurrency, remaining)
      if (take > 0) {
        next[line.fee_item] = take.toFixed(2)
        remaining -= take
      }
    }
    setAllocations(next)
  }

  const referenceRequired = methodType !== 'Cash'

  async function submit() {
    const amt = Number(amount)
    if (!student || !invoice || !amt || amt <= 0) {
      toast.error('Student, invoice and a positive amount are required.')
      return
    }
    if (!resolvedMethod) {
      toast.error('Select a payment method.')
      return
    }
    if (referenceRequired && !reference.trim()) {
      toast.error('A payment reference is required for non-cash payments.')
      return
    }
    if (!isBalanced) {
      toast.error(`${unallocated > 0 ? unallocated.toFixed(2) : `-${(-unallocated).toFixed(2)}`} unallocated -- allocation must total the payment amount.`)
      return
    }

    try {
      const { name, integrityHash } = await createReceipt.mutateAsync({
        student,
        invoice,
        payment_method: resolvedMethod.name,
        currency,
        amount: amt,
        posting_date: postingDate,
        external_reference: reference.trim() || undefined,
        narration: notes.trim() || undefined,
        allocations: Object.entries(allocations)
          .filter(([, v]) => Number(v) > 0)
          .map(([fee_item, v]) => ({ fee_item, amount: Number(v) })),
      })
      toast.success(`${name} recorded and posted`)
      setPosted({ name, integrityHash, amount: amt, method: resolvedMethod.method_name })
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this payment.')
    }
  }

  const selectedStudent = studentNames.get(student)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        {posted ? (
          <>
            <DialogHeader className='items-center text-center sm:items-center sm:text-center'>
              <div className='mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600'>
                <CheckCircle2 className='h-7 w-7' />
              </div>
              <DialogTitle>Payment recorded</DialogTitle>
              <DialogDescription>{posted.name} posted for <Money usd={currency === 'USD' ? posted.amount : zigToUsd(posted.amount, zigPerUsd)} /> via {posted.method}.</DialogDescription>
            </DialogHeader>
            <div className='flex justify-center'>
              <ReceiptActions
                receipt={{
                  receiptNumber: posted.name,
                  integrityHash: posted.integrityHash,
                  postingDate,
                  studentName: selectedStudent ? formatStudentName(selectedStudent.first_name, selectedStudent.last_name) : student,
                  studentId: student,
                  studentClass: selectedStudent?.grade,
                  amount: posted.amount,
                  currency,
                  paymentMethod: posted.method,
                  externalReference: reference || undefined,
                  narration: notes || undefined,
                }}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                  <BadgeDollarSign className='h-5 w-5' />
                </div>
                <div>
                  <DialogTitle>Record a payment</DialogTitle>
                  <DialogDescription>Posts immediately -- generates a receipt you can print or download.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className='grid gap-4 py-2'>
              {!studentId && (
                <div className='grid gap-2'>
                  <FieldLabel icon={GraduationCap} htmlFor='rp-student'>Student</FieldLabel>
                  {selectedStudent ? (
                    <div className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
                      <span className='flex items-center gap-2'>
                        <GraduationCap className='h-3.5 w-3.5 text-primary' />
                        {formatStudentName(selectedStudent.first_name, selectedStudent.last_name)} ({selectedStudent.name}) · {selectedStudent.grade ?? 'No grade'}
                      </span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='h-6 px-2 text-xs'
                        onClick={() => { setStudent(''); setInvoice(''); setAllocations({}) }}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className='grid grid-cols-[1fr_auto] gap-2'>
                        <div className='relative'>
                          <Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
                          <Input
                            id='rp-student'
                            className='pl-8'
                            placeholder='Search by name or student number…'
                            value={studentQuery}
                            onChange={(e) => setStudentQuery(e.target.value)}
                          />
                        </div>
                        <Select value={studentClassFilter || '__all__'} onValueChange={(v) => setStudentClassFilter(v === '__all__' ? '' : v)}>
                          <SelectTrigger className='w-36'><SelectValue placeholder='Class' /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value='__all__'>All classes</SelectItem>
                            {(classStreams ?? []).map((c) => <SelectItem key={c.name} value={c.stream_name}>{c.stream_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {(studentQuery || studentClassFilter) && (
                        <div className='max-h-48 divide-y overflow-y-auto rounded-md border'>
                          {studentMatches.length === 0 && (
                            <p className='px-3 py-2 text-sm text-muted-foreground'>No students match.</p>
                          )}
                          {studentMatches.map((s) => (
                            <button
                              key={s.name}
                              type='button'
                              className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50'
                              onClick={() => { setStudent(s.name); setStudentQuery(''); setStudentClassFilter(''); setInvoice(''); setAllocations({}) }}
                            >
                              <span>{formatStudentName(s.first_name, s.last_name)}</span>
                              <span className='text-xs text-muted-foreground'>{s.name} · {s.grade ?? 'No grade'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className='grid gap-2'>
                <FieldLabel icon={CalendarRange} htmlFor='rp-invoice'>Academic year / term</FieldLabel>
                <Select value={invoice} onValueChange={(v) => { setInvoice(v); setAllocations({}) }} disabled={!student}>
                  <SelectTrigger id='rp-invoice'><SelectValue placeholder={student ? 'Select a term…' : 'Pick a student first'} /></SelectTrigger>
                  <SelectContent>
                    {openInvoices.map((inv) => (
                      <SelectItem key={inv.name} value={inv.name}>
                        {inv.academic_year} · {inv.term} — {inv.outstanding_amount.toFixed(2)} outstanding
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {student && openInvoices.length === 0 && (
                  <p className='text-xs text-muted-foreground'>No outstanding invoices for this student.</p>
                )}
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='grid gap-2'>
                  <FieldLabel icon={currency === 'USD' ? DollarSign : Coins} htmlFor='rp-currency'>Currency</FieldLabel>
                  <Select value={currency} onValueChange={(v) => {
                    const next = v as 'USD' | 'ZiG'
                    setCurrency(next)
                    setBankMethod('')
                    resetAllocationsFor(Number(amount) || 0, next)
                  }}>
                    <SelectTrigger id='rp-currency'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='USD'><span className='flex items-center gap-2'><DollarSign className='h-3.5 w-3.5 text-emerald-600' />USD</span></SelectItem>
                      <SelectItem value='ZiG'><span className='flex items-center gap-2'><Coins className='h-3.5 w-3.5 text-amber-600' />ZiG</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <FieldLabel icon={Banknote} htmlFor='rp-amount'>Amount ({currency})</FieldLabel>
                  <div className='relative'>
                    <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground'>
                      {currency === 'USD' ? '$' : 'ZiG'}
                    </span>
                    <Input
                      id='rp-amount'
                      type='number'
                      min='0'
                      step='0.01'
                      className={currency === 'USD' ? 'pl-6' : 'pl-10'}
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); resetAllocationsFor(Number(e.target.value) || 0) }}
                    />
                  </div>
                </div>
              </div>
              {currency === 'ZiG' && amount && (
                <p className='text-xs text-muted-foreground'>≈ <Money usd={zigToUsd(Number(amount), zigPerUsd)} /> at ZiG {zigPerUsd} / USD</p>
              )}

              <div className='grid grid-cols-2 gap-3'>
                <div className='grid gap-2'>
                  <FieldLabel icon={Wallet} htmlFor='rp-method-type'>Payment method</FieldLabel>
                  <Select value={methodType} onValueChange={(v) => setMethodType(v as PaymentMethodType)}>
                    <SelectTrigger id='rp-method-type'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METHOD_TYPES.map(({ type, icon: Icon }) => (
                        <SelectItem key={type} value={type}>
                          <span className='flex items-center gap-2'><Icon className='h-3.5 w-3.5 text-primary' />{type}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {methodType === 'Bank Transfer' && (
                  <div className='grid gap-2'>
                    <FieldLabel icon={Landmark} htmlFor='rp-bank'>Bank account</FieldLabel>
                    <Select value={bankMethod} onValueChange={setBankMethod}>
                      <SelectTrigger id='rp-bank'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>
                        {eligibleMethods.map((pm) => <SelectItem key={pm.name} value={pm.name}>{pm.method_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {methodType === 'Bank Transfer' && eligibleMethods.length === 0 && (
                <p className='text-xs text-muted-foreground'>No {currency} bank account configured for transfers.</p>
              )}

              {lineBalances && lineBalances.length > 0 && (
                <div className='grid gap-2 rounded-md border border-l-4 border-l-primary/50 bg-muted/30 p-3'>
                  <SectionLabel className='mb-0 flex items-center gap-1.5 normal-case'>
                    <ListChecks className='h-3.5 w-3.5' />
                    Allocate to fee items
                  </SectionLabel>
                  {lineBalances.map((line) => (
                    <div key={line.fee_item} className='flex items-center justify-between gap-3'>
                      <div>
                        <p className='text-sm font-medium'>{line.fee_item}</p>
                        <p className='text-xs text-muted-foreground'>{line.outstanding.toFixed(2)} of {line.total.toFixed(2)} outstanding</p>
                      </div>
                      <Input
                        type='number'
                        min='0'
                        step='0.01'
                        className='w-28 bg-background'
                        value={allocations[line.fee_item] ?? ''}
                        onChange={(e) => setAllocations((prev) => ({ ...prev, [line.fee_item]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium',
                      isBalanced ? 'text-emerald-600' : 'text-destructive'
                    )}
                  >
                    {isBalanced ? <CheckCircle2 className='h-3.5 w-3.5' /> : <AlertTriangle className='h-3.5 w-3.5' />}
                    Unallocated: {unallocated.toFixed(2)} {currency}
                  </p>
                </div>
              )}

              <div className='grid grid-cols-2 gap-3'>
                <div className='grid gap-2'>
                  <FieldLabel icon={CalendarRange} htmlFor='rp-date'>Posting date</FieldLabel>
                  <Input id='rp-date' type='date' value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
                </div>
                <div className='grid gap-2'>
                  <FieldLabel icon={Hash} htmlFor='rp-reference'>Reference {referenceRequired ? '(required)' : '(optional)'}</FieldLabel>
                  <Input id='rp-reference' value={reference} onChange={(e) => setReference(e.target.value)} placeholder='Bank txn ID, EcoCash code…' />
                </div>
              </div>

              <div className='grid gap-2'>
                <FieldLabel icon={StickyNote} htmlFor='rp-notes'>Notes (optional)</FieldLabel>
                <Textarea id='rp-notes' rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='e.g. Term 1 tuition, cash' />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={createReceipt.isPending}>
                {createReceipt.isPending ? 'Posting…' : 'Confirm payment'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
