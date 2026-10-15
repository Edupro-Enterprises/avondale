import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAccounts } from '@/lib/frappe/accounts'
import { useBankNameByAccount } from '@/lib/frappe/school-setup'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import {
  useBankReconciliations,
  useBankReconciliation,
  useCreateBankReconciliation,
  useSetBankReconciliationState,
  type NewAdjustmentInput,
  type FrappeBankReconciliation,
} from '@/lib/frappe/bank-reconciliations'

export const Route = createFileRoute('/_authenticated/bursar/finance/bank-reconciliation')({
  component: BankReconciliationPage,
})

const stateTone: Record<FrappeBankReconciliation['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending Head Sign-Off': 'warning',
  Reconciled: 'good',
  'Discrepancy Flagged': 'bad',
}

const emptyAdjustment: NewAdjustmentInput = { adjustment_type: 'Deposit in Transit', description: '', amount: 0 }

function BankReconciliationPage() {
  const { data: reconciliations, isLoading, error } = useBankReconciliations()
  const { data: accounts } = useAccounts()
  const bankNameByAccount = useBankNameByAccount()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const bankAccounts = useMemo(() => (accounts ?? []).filter((a) => a.account_type === 'Asset'), [accounts])
  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  function amountFor(amount: number, account: string) {
    return <Money usd={accountCurrency.get(account) === 'USD' ? amount : zigToUsd(amount, zigPerUsd)} />
  }
  function bankLabel(account: string) {
    return bankNameByAccount.get(account) ?? account
  }
  const createReconciliation = useCreateBankReconciliation()
  const setState = useSetBankReconciliationState()

  const [viewingName, setViewingName] = useState<string | null>(null)
  const { data: viewing } = useBankReconciliation(viewingName ?? undefined)
  const [newOpen, setNewOpen] = useState(false)

  const [bankAccount, setBankAccount] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [statementBalance, setStatementBalance] = useState('')
  const [adjustments, setAdjustments] = useState<NewAdjustmentInput[]>([{ ...emptyAdjustment }])

  function resetForm() {
    setBankAccount('')
    setPeriodEnd('')
    setStatementBalance('')
    setAdjustments([{ ...emptyAdjustment }])
  }

  const isDirty = bankAccount !== '' || periodEnd !== '' || statementBalance !== '' || adjustments.some((a) => a.description !== '' || a.amount !== 0)
  const guard = useUnsavedChangesGuard(isDirty, () => { setNewOpen(false); resetForm() })

  async function submit() {
    const cleanAdjustments = adjustments.filter((a) => a.description.trim() && a.amount !== 0)
    if (!bankAccount || !periodEnd || !statementBalance) {
      toast.error('Bank account, period end and statement balance are all required.')
      return
    }
    try {
      const created = await createReconciliation.mutateAsync({
        bank_account: bankAccount,
        period_end: periodEnd,
        balance_per_statement: Number(statementBalance),
        adjustments: cleanAdjustments,
      })
      toast.success(`${created.name} saved -- variance ${created.variance.toFixed(2)}`)
      setNewOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not save this reconciliation.')
    }
  }

  async function submitForSignoff() {
    if (!viewing) return
    try {
      await setState.mutateAsync({ name: viewing.name, workflow_state: 'Pending Head Sign-Off' })
      toast.success('Submitted for School Head sign-off')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not submit this reconciliation.')
    }
  }

  const rows = reconciliations ?? []

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Finance</p>
            <h1 className='text-3xl font-bold tracking-tight'>Bank Reconciliation</h1>
            <p className='text-sm text-muted-foreground'>The cashbook balance is computed from posted Journal Entries -- reconciling items close the gap to the statement.</p>
          </div>
          <Dialog open={newOpen} onOpenChange={(o) => (o ? setNewOpen(true) : guard.handleOpenChange(o))}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />New reconciliation</Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-lg'>
              <DialogHeader><DialogTitle>New bank reconciliation</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Bank account' className='col-span-2'>
                  <Select value={bankAccount} onValueChange={setBankAccount}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{bankAccounts.map((a) => <SelectItem key={a.name} value={a.name}>{bankLabel(a.name)}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Period end'>
                  <Input type='date' className={compactControlClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </CompactField>
                <CompactField label='Statement balance'>
                  <Input type='number' step='0.01' className={compactControlClass} value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
                </CompactField>

                <div className='col-span-2 mt-2'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground'>Reconciling items</p>
                    <Button type='button' variant='outline' size='sm' onClick={() => setAdjustments((p) => [...p, { ...emptyAdjustment }])}>
                      <Plus className='h-3.5 w-3.5' />Add
                    </Button>
                  </div>
                  <div className='grid gap-2'>
                    {adjustments.map((a, i) => (
                      <div key={i} className='grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]'>
                        <Select value={a.adjustment_type} onValueChange={(v) => setAdjustments((p) => p.map((x, j) => (j === i ? { ...x, adjustment_type: v as NewAdjustmentInput['adjustment_type'] } : x)))}>
                          <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value='Deposit in Transit'>Deposit in Transit</SelectItem>
                            <SelectItem value='Unpresented Cheque'>Unpresented Cheque</SelectItem>
                            <SelectItem value='Bank Charge'>Bank Charge</SelectItem>
                            <SelectItem value='Other Adjustment'>Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input className={compactControlClass} placeholder='Description' value={a.description} onChange={(e) => setAdjustments((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                        <Input type='number' step='0.01' className={compactControlClass} placeholder='± amount' value={a.amount || ''} onChange={(e) => setAdjustments((p) => p.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))} />
                        <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setAdjustments((p) => p.filter((_, j) => j !== i))} disabled={adjustments.length === 1} aria-label='Remove this item'>
                          <X className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className='mt-2 text-xs text-muted-foreground'>Enter unpresented cheques and other reductions as negative amounts.</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createReconciliation.isPending}>{createReconciliation.isPending ? 'Saving…' : 'Save reconciliation'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog {...guard.discardDialogProps} />
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load bank reconciliations from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Reconciliations</CardTitle>
            <CardDescription>{rows.length} on record</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            {isLoading && <p className='py-4 text-sm text-muted-foreground'>Loading…</p>}
            <div className='divide-y'>
              {rows.map((rec) => (
                <button
                  key={rec.name}
                  onClick={() => setViewingName(rec.name)}
                  className='flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-muted/50 -mx-2 px-2 rounded-md'
                >
                  <div>
                    <p className='text-sm font-medium'>{bankLabel(rec.bank_account)}</p>
                    <p className='text-xs text-muted-foreground'>Period end {rec.period_end}</p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <StatusBadge tone={rec.variance === 0 ? 'good' : 'warning'}>{rec.variance === 0 ? 'Balanced' : `${rec.variance > 0 ? '+' : ''}${rec.variance.toFixed(2)}`}</StatusBadge>
                    <StatusBadge tone={stateTone[rec.workflow_state]}>{rec.workflow_state}</StatusBadge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!viewingName} onOpenChange={(o) => !o && setViewingName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{viewing ? bankLabel(viewing.bank_account) : ''}</DialogTitle>
            </DialogHeader>
            {viewing && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Period end</span><span>{viewing.period_end}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Statement balance</span>{amountFor(viewing.balance_per_statement, viewing.bank_account)}</div>
                {viewing.adjustments.length > 0 && (
                  <div>
                    <p className='mb-1 text-xs font-medium text-muted-foreground'>Reconciling items</p>
                    <div className='divide-y rounded-md border'>
                      {viewing.adjustments.map((a) => (
                        <div key={a.name} className='flex items-center justify-between px-3 py-2'>
                          <span>{a.description} <span className='text-xs text-muted-foreground'>({a.adjustment_type})</span></span>
                          {amountFor(a.amount, viewing.bank_account)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className='flex justify-between border-t pt-3 font-medium'><span>Reconciled balance</span>{amountFor(viewing.reconciled_balance, viewing.bank_account)}</div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Cashbook balance</span>{amountFor(viewing.balance_per_cashbook, viewing.bank_account)}</div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Variance</span><StatusBadge tone={viewing.variance === 0 ? 'good' : 'warning'}>{viewing.variance.toFixed(2)}</StatusBadge></div>
              </div>
            )}
            {viewing?.workflow_state === 'Draft' && (
              <DialogFooter>
                <Button onClick={submitForSignoff} disabled={setState.isPending}>
                  {setState.isPending ? 'Submitting…' : 'Submit for School Head sign-off'}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
