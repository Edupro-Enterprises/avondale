import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarCheck, Landmark, Plus, Smartphone, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useCurrentUser } from '@/lib/frappe/auth'
import { usePaymentMethods, type PaymentMethodType } from '@/lib/frappe/receipts'
import { useCashUps, useCashUp, useSubmitCashUp, useTodayReceiptTotals, type FrappeCashUp, type CashUpResult } from '@/lib/frappe/cash-ups'

const METHOD_TYPE_ICON: Record<PaymentMethodType, React.ElementType> = {
  Cash: Wallet,
  'Bank Transfer': Landmark,
  EcoCash: Smartphone,
}

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/daily-cash-up')({
  component: DailyCashUpPage,
})

const VARIANCE_WARN_THRESHOLD = 10
const todayIso = () => new Date().toISOString().slice(0, 10)

function varianceTone(variance: number): StatusTone {
  if (variance === 0) return 'good'
  return Math.abs(variance) > VARIANCE_WARN_THRESHOLD ? 'bad' : 'warning'
}

const stateTone: Record<FrappeCashUp['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  Balanced: 'good',
  'Variance Flagged': 'bad',
  Resolved: 'good',
}

function DailyCashUpPage() {
  const { data: cashUps, isLoading, error } = useCashUps()
  const { data: paymentMethods } = usePaymentMethods()
  const { user } = useCurrentUser()
  const [newOpen, setNewOpen] = useState(false)
  const [cashUpDate, setCashUpDate] = useState(todayIso)
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [handoverTo, setHandoverTo] = useState('')
  const [cashHandedOver, setCashHandedOver] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<CashUpResult | null>(null)
  const [viewingName, setViewingName] = useState<string | null>(null)

  const { data: expected } = useTodayReceiptTotals(user?.name, cashUpDate)
  const submitCashUp = useSubmitCashUp()
  const { data: viewing } = useCashUp(viewingName ?? undefined)

  const lines = useMemo(
    () => (paymentMethods ?? []).map((pm) => ({
      method: pm.method_name,
      methodType: pm.method_type,
      name: pm.name,
      expected: expected?.get(pm.name) ?? 0,
      counted: Number(counted[pm.name] || 0),
    })),
    [paymentMethods, expected, counted]
  )
  const totalVariance = lines.reduce((sum, l) => sum + (l.counted - l.expected), 0)

  function updateCounted(method: string, value: string) {
    setCounted((prev) => ({ ...prev, [method]: value }))
  }

  function resetForm() {
    setCashUpDate(todayIso())
    setCounted({})
    setHandoverTo('')
    setCashHandedOver('')
    setNotes('')
  }

  const isDirty = Object.values(counted).some((v) => Number(v) !== 0) || notes !== '' || handoverTo !== ''
  const guard = useUnsavedChangesGuard(isDirty, () => { setNewOpen(false); resetForm() })

  async function handleSubmit() {
    try {
      const res = await submitCashUp.mutateAsync({
        cashUpDate,
        lines: lines.map((l) => ({ payment_method: l.name, counted_amount: l.counted })),
        handoverTo: handoverTo || undefined,
        cashHandedOver: cashHandedOver ? Number(cashHandedOver) : undefined,
        notes: notes || undefined,
      })
      setResult(res)
      setNewOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not submit this cash-up.')
    }
  }

  const columns: DataListColumn<FrappeCashUp>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (cu) => cu.cash_up_date,
      className: 'min-w-40',
      cell: (cu) => (
        <div className='flex flex-col'>
          <span className='truncate'>{cu.cash_up_date}</span>
          <span className='truncate text-xs text-muted-foreground'>{cu.cashier}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (cu) => cu.workflow_state,
      cell: (cu) => <StatusBadge tone={stateTone[cu.workflow_state]}>{cu.workflow_state}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Payment Desk</p>
            <h1 className='text-3xl font-bold tracking-tight'>Daily Cash-Up</h1>
            <p className='text-sm text-muted-foreground'>Count each payment method against your own submitted receipts for the day.</p>
          </div>
          <Dialog open={newOpen} onOpenChange={(o) => (o ? setNewOpen(true) : guard.handleOpenChange(o))}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />New cash-up</Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-2xl'>
              <DialogHeader>
                <div className='flex items-center gap-3'>
                  <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                    <CalendarCheck className='h-5 w-5' />
                  </div>
                  <div>
                    <DialogTitle>Today's cash-up</DialogTitle>
                    <DialogDescription>Enter what you actually counted per payment method.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className='grid max-h-[70vh] gap-3 overflow-y-auto py-2 pr-1'>
                <div className='grid gap-2 sm:w-48'>
                  <Label htmlFor='cash-up-date'>Date</Label>
                  <Input id='cash-up-date' type='date' value={cashUpDate} onChange={(e) => setCashUpDate(e.target.value)} />
                </div>

                <div className='grid gap-2 sm:grid-cols-2'>
                  {lines.map((l) => {
                    const variance = l.counted - l.expected
                    const Icon = METHOD_TYPE_ICON[l.methodType] ?? Wallet
                    return (
                      <div key={l.name} className='grid gap-2 rounded-md border p-3'>
                        <div className='flex items-center justify-between'>
                          <span className='flex items-center gap-1.5 text-sm font-medium'>
                            <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary'>
                              <Icon className='h-3.5 w-3.5' />
                            </span>
                            {l.method}
                          </span>
                          <StatusBadge tone={varianceTone(variance)}>
                            {variance === 0 ? 'Matches' : `${variance > 0 ? '+' : ''}${variance.toFixed(2)}`}
                          </StatusBadge>
                        </div>
                        <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
                          <span>Expected <Money usd={l.expected} compact className='text-foreground' /></span>
                        </div>
                        <Input
                          type='number'
                          placeholder='Counted amount'
                          value={counted[l.name] || ''}
                          onChange={(e) => updateCounted(l.name, e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className='flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2'>
                  <span className='text-sm font-medium'>Total variance (preview)</span>
                  <StatusBadge tone={varianceTone(totalVariance)}>{totalVariance === 0 ? 'Balanced' : `${totalVariance > 0 ? '+' : ''}${totalVariance.toFixed(2)}`}</StatusBadge>
                </div>
                <p className='text-xs text-muted-foreground'>The server recomputes this authoritatively on submit -- this is only a preview.</p>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='handover-to'>Handed over to (optional)</Label>
                    <Input id='handover-to' value={handoverTo} onChange={(e) => setHandoverTo(e.target.value)} placeholder='User ID' />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='cash-handed-over'>Cash handed over (optional)</Label>
                    <Input id='cash-handed-over' type='number' value={cashHandedOver} onChange={(e) => setCashHandedOver(e.target.value)} />
                  </div>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='notes'>Notes (optional)</Label>
                  <Textarea id='notes' rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='Explain any variance' />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={submitCashUp.isPending} onClick={handleSubmit}>
                  {submitCashUp.isPending ? 'Submitting…' : 'Submit cash-up'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog {...guard.discardDialogProps} />
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load cash-ups from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Recent cash-ups</CardTitle>
            <CardDescription>{(cashUps ?? []).length} recorded</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={cashUps ?? []}
              columns={columns}
              getRowId={(cu) => cu.name}
              isLoading={isLoading}
              onRowClick={(cu) => setViewingName(cu.name)}
              densityStorageKey='daily-cash-ups'
              defaultSort={[{ id: 'date', desc: true }]}
              emptyState={{ icon: CalendarCheck, title: 'No cash-ups recorded', description: 'Cash-ups will appear here once submitted.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!viewingName} onOpenChange={(o) => !o && setViewingName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cash-up · {viewing?.cash_up_date}</DialogTitle>
              <DialogDescription><StatusBadge tone={viewing ? stateTone[viewing.workflow_state] : 'neutral'}>{viewing?.workflow_state}</StatusBadge></DialogDescription>
            </DialogHeader>
            {viewing && (
              <div className='space-y-3 text-sm'>
                <div className='divide-y rounded-md border'>
                  {viewing.lines.map((l) => (
                    <div key={l.name} className='flex items-center justify-between px-3 py-2'>
                      <span>{l.payment_method}</span>
                      <span className='flex items-center gap-2'>
                        <Money usd={l.counted_amount} compact /> <span className='text-xs text-muted-foreground'>of <Money usd={l.system_amount} compact /></span>
                        <StatusBadge tone={varianceTone(l.variance)}>{l.variance === 0 ? 'OK' : l.variance.toFixed(2)}</StatusBadge>
                      </span>
                    </div>
                  ))}
                </div>
                <div className='space-y-1 text-xs text-muted-foreground'>
                  {viewing.handover_to && <p>Handed over to {viewing.handover_to}{viewing.cash_handed_over ? ` (${viewing.cash_handed_over.toFixed(2)})` : ''}</p>}
                  {viewing.reviewed_by && <p>Reviewed by {viewing.reviewed_by} on {viewing.reviewed_on}</p>}
                  {viewing.notes && <p>Notes: {viewing.notes}</p>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{result?.name}</DialogTitle>
              <DialogDescription><StatusBadge tone={result ? stateTone[result.workflow_state] : 'neutral'}>{result?.workflow_state}</StatusBadge></DialogDescription>
            </DialogHeader>
            {result && (
              <div className='space-y-3 text-sm'>
                <div className='divide-y rounded-md border'>
                  {result.lines.map((l) => (
                    <div key={l.payment_method} className='flex items-center justify-between px-3 py-2'>
                      <span>{l.payment_method}</span>
                      <span className='flex items-center gap-2'>
                        <Money usd={l.counted_amount} compact /> <span className='text-xs text-muted-foreground'>of <Money usd={l.system_amount} compact /></span>
                        <StatusBadge tone={varianceTone(l.variance)}>{l.variance === 0 ? 'OK' : l.variance.toFixed(2)}</StatusBadge>
                      </span>
                    </div>
                  ))}
                </div>
                {result.workflow_state === 'Variance Flagged' && (
                  <p className='text-xs text-destructive'>This cash-up needs a School Head to review and resolve the variance before further cash-ups can be submitted.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
