import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge } from '@/components/status-badge'
import { DataList, type DataListColumn } from '@/components/data-list'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { FrappeApiError, uploadFile } from '@/lib/frappe/client'
import { useAccounts } from '@/lib/frappe/accounts'
import { useBudgetLines } from '@/lib/frappe/budget-lines'
import { usePaymentMethods } from '@/lib/frappe/receipts'
import { useCurrentUser } from '@/lib/frappe/auth'
import {
  usePettyCashFloats,
  usePettyCashVouchers,
  useCreatePettyCashFloat,
  useCreatePettyCashVoucher,
  useCreatePettyCashReplenishment,
  type FrappePettyCashFloat,
} from '@/lib/frappe/petty-cash'

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/petty-cash')({
  component: PettyCashPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

function PettyCashPage() {
  const { data: floats, isLoading, error } = usePettyCashFloats()
  const { data: accounts } = useAccounts()
  const { data: budgetLines } = useBudgetLines()
  const { data: paymentMethods } = usePaymentMethods()
  const { user } = useCurrentUser()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [newFloatOpen, setNewFloatOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [replenishOpen, setReplenishOpen] = useState(false)

  const createFloat = useCreatePettyCashFloat()
  const createVoucher = useCreatePettyCashVoucher()
  const createReplenishment = useCreatePettyCashReplenishment()

  const selected = (floats ?? []).find((f) => f.name === selectedName) ?? null
  const { data: vouchers } = usePettyCashVouchers(selectedName ?? undefined)
  const pendingVouchers = (vouchers ?? []).filter((v) => v.status === 'Pending Reimbursement')
  const pendingTotal = pendingVouchers.reduce((sum, v) => sum + v.amount, 0)

  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])

  function toUSD(amount: number, account: string) {
    return accountCurrency.get(account) === 'USD' ? amount : zigToUsd(amount, zigPerUsd)
  }

  // --- New float form ---
  const [floatName, setFloatName] = useState('')
  const [custodian, setCustodian] = useState('')
  const [account, setAccount] = useState('')
  const [floatAmount, setFloatAmount] = useState('')

  function resetFloatForm() {
    setFloatName('')
    setCustodian(user?.name ?? '')
    setAccount('')
    setFloatAmount('')
  }

  async function submitNewFloat() {
    if (!floatName.trim() || !custodian.trim() || !account || !Number(floatAmount)) {
      toast.error('Name, custodian, account and a positive ceiling are all required.')
      return
    }
    try {
      await createFloat.mutateAsync({ float_name: floatName.trim(), custodian: custodian.trim(), account, float_amount: Number(floatAmount) })
      toast.success(`${floatName.trim()} created`)
      setNewFloatOpen(false)
      resetFloatForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this float.')
    }
  }

  // --- Record expense form ---
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseBudgetLine, setExpenseBudgetLine] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayIso)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined)

  function resetExpenseForm() {
    setExpenseDescription('')
    setExpenseAmount('')
    setExpenseBudgetLine('')
    setExpenseDate(todayIso())
    setReceiptUrl(undefined)
  }

  async function handleReceiptChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingReceipt(true)
    try {
      const url = await uploadFile(file, { isPrivate: true })
      setReceiptUrl(url)
      toast.success('Receipt attached')
    } catch {
      toast.error('Could not upload this receipt.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function submitExpense() {
    if (!selected) return
    const amount = Number(expenseAmount)
    if (!expenseDescription.trim() || !amount || amount <= 0 || !expenseBudgetLine) {
      toast.error('Description, budget line and a positive amount are all required.')
      return
    }
    try {
      await createVoucher.mutateAsync({
        petty_cash_float: selected.name,
        posting_date: expenseDate,
        description: expenseDescription.trim(),
        amount,
        budget_line: expenseBudgetLine,
        receipt_attachment: receiptUrl,
      })
      toast.success('Expense recorded')
      setExpenseOpen(false)
      resetExpenseForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this expense.')
    }
  }

  // --- Replenish form ---
  const [replenishPaymentMethod, setReplenishPaymentMethod] = useState('')
  const [replenishDate, setReplenishDate] = useState(todayIso)

  async function submitReplenishment() {
    if (!selected || !replenishPaymentMethod) {
      toast.error('Pick a payment method to draw the replenishment from.')
      return
    }
    try {
      const result = await createReplenishment.mutateAsync({
        petty_cash_float: selected.name,
        posting_date: replenishDate,
        payment_method: replenishPaymentMethod,
      })
      toast.success(`${selected.name} replenished by ${result.amount.toFixed(2)}`)
      setReplenishOpen(false)
      setReplenishPaymentMethod('')
      setReplenishDate(todayIso())
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not replenish this float.')
    }
  }

  const columns: DataListColumn<FrappePettyCashFloat>[] = [
    { id: 'name', header: 'Float', sortable: true, sortValue: (f) => f.name, className: 'min-w-32', cell: (f) => f.name },
    { id: 'custodian', header: 'Custodian', sortable: true, sortValue: (f) => f.custodian, cell: (f) => f.custodian },
    {
      id: 'balance',
      header: 'Balance',
      sortable: true,
      sortValue: (f) => toUSD(f.balance, f.account),
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (f) => <Money usd={toUSD(f.balance, f.account)} />,
    },
    {
      id: 'ceiling',
      header: 'Ceiling',
      sortable: true,
      sortValue: (f) => toUSD(f.float_amount, f.account),
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (f) => <Money usd={toUSD(f.float_amount, f.account)} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (f) => f.status,
      cell: (f) => <StatusBadge tone={f.status === 'Active' ? 'good' : 'neutral'}>{f.status}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Payment Desk</p>
            <h1 className='text-3xl font-bold tracking-tight'>Petty Cash</h1>
          </div>
          <Dialog open={newFloatOpen} onOpenChange={(o) => { setNewFloatOpen(o); if (o) resetFloatForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />New float</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a petty cash float</DialogTitle></DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='float-name'>Float name</Label>
                  <Input id='float-name' value={floatName} onChange={(e) => setFloatName(e.target.value)} placeholder='Front Office Float' />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='custodian'>Custodian (user ID)</Label>
                  <Input id='custodian' value={custodian} onChange={(e) => setCustodian(e.target.value)} placeholder={user?.name ?? 'bursar@school.edu.zw'} />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='account'>Imprest account</Label>
                  <Select value={account} onValueChange={setAccount}>
                    <SelectTrigger id='account'><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>
                      {(accounts ?? []).map((a) => <SelectItem key={a.name} value={a.name}>{a.name} ({a.currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='float-amount'>Ceiling</Label>
                  <Input id='float-amount' type='number' min='0' step='0.01' value={floatAmount} onChange={(e) => setFloatAmount(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitNewFloat} disabled={createFloat.isPending}>{createFloat.isPending ? 'Creating…' : 'Create float'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load petty cash floats from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Floats</CardTitle>
            <CardDescription>{(floats ?? []).length} floats</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={floats ?? []}
              columns={columns}
              getRowId={(f) => f.name}
              isLoading={isLoading}
              onRowClick={(f) => setSelectedName(f.name)}
              densityStorageKey='petty-cash-floats'
              emptyState={{ icon: Wallet, title: 'No floats found', description: 'Create a float to start recording petty cash expenses.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription>Custodian {selected?.custodian}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='rounded-md border p-3'>
                    <p className='text-xs text-muted-foreground'>Balance</p>
                    <p className='text-lg font-semibold'><Money usd={toUSD(selected.balance, selected.account)} /></p>
                  </div>
                  <div className='rounded-md border p-3'>
                    <p className='text-xs text-muted-foreground'>Ceiling</p>
                    <p className='text-lg font-semibold'><Money usd={toUSD(selected.float_amount, selected.account)} /></p>
                  </div>
                </div>

                <div className='flex gap-2'>
                  <Button size='sm' onClick={() => setExpenseOpen(true)} disabled={selected.status !== 'Active'}>Record expense</Button>
                  <Button size='sm' variant='outline' onClick={() => setReplenishOpen(true)} disabled={pendingVouchers.length === 0}>
                    Replenish{pendingVouchers.length > 0 ? ` (${pendingVouchers.length})` : ''}
                  </Button>
                </div>

                <div>
                  <p className='mb-1 text-xs font-medium text-muted-foreground'>Vouchers</p>
                  <div className='divide-y rounded-md border'>
                    {(vouchers ?? []).length === 0 && <p className='px-3 py-3 text-sm text-muted-foreground'>No vouchers yet.</p>}
                    {(vouchers ?? []).map((v) => (
                      <div key={v.name} className='flex items-center justify-between px-3 py-2'>
                        <div>
                          <p>{v.description}</p>
                          <p className='text-xs text-muted-foreground'>{v.posting_date} · {v.budget_line}</p>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Money usd={toUSD(v.amount, selected.account)} />
                          <StatusBadge tone={v.status === 'Reimbursed' ? 'good' : 'warning'}>{v.status}</StatusBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={expenseOpen} onOpenChange={(o) => { setExpenseOpen(o); if (o) resetExpenseForm() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record an expense</DialogTitle>
              <DialogDescription>Against {selected?.name} -- posts as Pending Reimbursement.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='grid gap-2'>
                <Label htmlFor='expense-description'>Description</Label>
                <Input id='expense-description' value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder='What was this for?' />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='grid gap-2'>
                  <Label htmlFor='expense-amount'>Amount</Label>
                  <Input id='expense-amount' type='number' min='0' step='0.01' value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='expense-date'>Date</Label>
                  <Input id='expense-date' type='date' value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                </div>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='budget-line'>Budget line</Label>
                <Select value={expenseBudgetLine} onValueChange={setExpenseBudgetLine}>
                  <SelectTrigger id='budget-line'><SelectValue placeholder='Select…' /></SelectTrigger>
                  <SelectContent>
                    {(budgetLines ?? []).map((b) => <SelectItem key={b.name} value={b.name}>{b.vote_code} — {b.description}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <Label>Receipt (optional)</Label>
                <input ref={fileInputRef} type='file' className='hidden' onChange={handleReceiptChosen} />
                <Button type='button' variant='outline' size='sm' className='w-fit' onClick={() => fileInputRef.current?.click()} disabled={uploadingReceipt}>
                  {uploadingReceipt ? 'Uploading…' : receiptUrl ? 'Replace receipt' : 'Attach receipt'}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitExpense} disabled={createVoucher.isPending}>{createVoucher.isPending ? 'Recording…' : 'Record expense'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={replenishOpen} onOpenChange={setReplenishOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replenish {selected?.name}</DialogTitle>
              <DialogDescription>Reimburses every Pending Reimbursement voucher on this float.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Pending vouchers</span>
                <span>{pendingVouchers.length}</span>
              </div>
              <div className='flex justify-between font-medium'>
                <span>Total to replenish</span>
                <Money usd={selected ? toUSD(pendingTotal, selected.account) : 0} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='replenish-method'>Payment method (drawn from)</Label>
                <Select value={replenishPaymentMethod} onValueChange={setReplenishPaymentMethod}>
                  <SelectTrigger id='replenish-method'><SelectValue placeholder='Select…' /></SelectTrigger>
                  <SelectContent>
                    {(paymentMethods ?? []).map((pm) => <SelectItem key={pm.name} value={pm.name}>{pm.method_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='replenish-date'>Date</Label>
                <Input id='replenish-date' type='date' value={replenishDate} onChange={(e) => setReplenishDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitReplenishment} disabled={createReplenishment.isPending}>
                {createReplenishment.isPending ? 'Replenishing…' : 'Replenish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
