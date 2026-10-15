import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
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
import { FrappeApiError } from '@/lib/frappe/client'
import { useAccounts } from '@/lib/frappe/accounts'
import type { Fund } from '@/lib/frappe/journal-entries'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import {
  useBudgetVoteBooks,
  useCreateBudgetVoteBook,
  useSetBudgetVoteBookState,
  useBudgetLines,
  useCreateBudgetLine,
} from '@/lib/frappe/budget-lines'

export const Route = createFileRoute('/_authenticated/bursar/finance/budget-vote-book')({
  component: BudgetVoteBookPage,
})

const FUNDS: Fund[] = ['Fund A - General/Government', 'Fund B - SDC/SDA']

function BudgetVoteBookPage() {
  const { data: voteBooks } = useBudgetVoteBooks()
  const { data: budgetLines, isLoading, error } = useBudgetLines()
  const { data: accounts } = useAccounts()
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  /** Budget Line amounts have no currency field of their own -- they inherit
   * the expense_account's currency (committed/actual deltas post straight
   * numeric, with no FX conversion -- see budget_line.py's adjust()), so
   * this looks up that account's currency per line and converts to USD for
   * display, matching every other list/dashboard/report in this app. */
  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  function formatBudgetAmount(amount: number, expenseAccount: string) {
    const usd = accountCurrency.get(expenseAccount) === 'USD' ? amount : zigToUsd(amount, zigPerUsd)
    return <Money usd={usd} compact />
  }
  const createVoteBook = useCreateBudgetVoteBook()
  const setVoteBookState = useSetBudgetVoteBookState()
  const createBudgetLine = useCreateBudgetLine()

  const [selectedVoteBook, setSelectedVoteBook] = useState<string | null>(null)

  const [newVoteBookOpen, setNewVoteBookOpen] = useState(false)
  const [academicYear, setAcademicYear] = useState('')

  const [newLineOpen, setNewLineOpen] = useState(false)
  const [voteCode, setVoteCode] = useState('')
  const [description, setDescription] = useState('')
  const [fund, setFund] = useState<Fund>(FUNDS[0])
  const [expenseAccount, setExpenseAccount] = useState('')
  const [approvedBudget, setApprovedBudget] = useState('')

  const activeVoteBook = selectedVoteBook ?? (voteBooks ?? []).find((v) => v.workflow_state === 'Active')?.name ?? (voteBooks ?? [])[0]?.name
  const visibleLines = useMemo(
    () => (budgetLines ?? []).filter((l) => !activeVoteBook || l.budget_vote_book === activeVoteBook),
    [budgetLines, activeVoteBook]
  )

  async function submitNewVoteBook() {
    if (!academicYear.trim()) {
      toast.error('Academic year is required.')
      return
    }
    try {
      const name = await createVoteBook.mutateAsync(academicYear.trim())
      toast.success(`${name} created as Draft`)
      setNewVoteBookOpen(false)
      setAcademicYear('')
      setSelectedVoteBook(name)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this vote book.')
    }
  }

  async function activateVoteBook(name: string) {
    try {
      await setVoteBookState.mutateAsync({ name, workflow_state: 'Active' })
      toast.success(`${name} activated`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not activate this vote book.')
    }
  }

  function resetLineForm() {
    setVoteCode('')
    setDescription('')
    setFund(FUNDS[0])
    setExpenseAccount('')
    setApprovedBudget('')
  }

  async function submitNewLine() {
    const amount = Number(approvedBudget)
    if (!activeVoteBook || !voteCode.trim() || !description.trim() || !expenseAccount || !amount) {
      toast.error('Vote code, description, expense account and a positive approved budget are all required.')
      return
    }
    try {
      await createBudgetLine.mutateAsync({
        budget_vote_book: activeVoteBook,
        vote_code: voteCode.trim(),
        description: description.trim(),
        fund,
        expense_account: expenseAccount,
        approved_budget: amount,
      })
      toast.success('Budget line added')
      setNewLineOpen(false)
      resetLineForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this budget line.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Finance</p>
            <h1 className='text-3xl font-bold tracking-tight'>Budget Vote Book</h1>
            <p className='text-sm text-muted-foreground'>Approved budget, committed (encumbered) spend, and what remains available.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Select value={activeVoteBook ?? ''} onValueChange={setSelectedVoteBook}>
              <SelectTrigger className='w-56'><SelectValue placeholder='Select a vote book' /></SelectTrigger>
              <SelectContent>
                {(voteBooks ?? []).map((v) => <SelectItem key={v.name} value={v.name}>{v.academic_year} ({v.workflow_state})</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={newVoteBookOpen} onOpenChange={setNewVoteBookOpen}>
              <DialogTrigger asChild><Button variant='outline'><Plus className='h-4 w-4' />New vote book</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a budget vote book</DialogTitle></DialogHeader>
                <div className='grid gap-2 py-2'>
                  <Label htmlFor='academic-year'>Academic year</Label>
                  <Input id='academic-year' value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder='2027 Academic Year' />
                </div>
                <DialogFooter>
                  <Button onClick={submitNewVoteBook} disabled={createVoteBook.isPending}>{createVoteBook.isPending ? 'Creating…' : 'Create'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={newLineOpen} onOpenChange={(o) => { setNewLineOpen(o); if (o) resetLineForm() }}>
              <DialogTrigger asChild>
                <Button disabled={!activeVoteBook}><Plus className='h-4 w-4' />New budget line</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add a budget line</DialogTitle><DialogDescription>Against {activeVoteBook}</DialogDescription></DialogHeader>
                <div className='grid gap-4 py-2'>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='grid gap-2'>
                      <Label htmlFor='vote-code'>Vote code</Label>
                      <Input id='vote-code' value={voteCode} onChange={(e) => setVoteCode(e.target.value)} placeholder='STAT-001' />
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='fund'>Fund</Label>
                      <Select value={fund} onValueChange={(v) => setFund(v as Fund)}>
                        <SelectTrigger id='fund'><SelectValue /></SelectTrigger>
                        <SelectContent>{FUNDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='line-description'>Description</Label>
                    <Input id='line-description' value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='expense-account'>Expense account</Label>
                    <Select value={expenseAccount} onValueChange={setExpenseAccount}>
                      <SelectTrigger id='expense-account'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>{(accounts ?? []).filter((a) => a.account_type === 'Expense').map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='approved-budget'>Approved budget</Label>
                    <Input id='approved-budget' type='number' min='0' step='0.01' value={approvedBudget} onChange={(e) => setApprovedBudget(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitNewLine} disabled={createBudgetLine.isPending}>{createBudgetLine.isPending ? 'Adding…' : 'Add budget line'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load budget lines from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        {activeVoteBook && (voteBooks ?? []).find((v) => v.name === activeVoteBook)?.workflow_state === 'Draft' && (
          <Card className='mb-6'>
            <CardContent className='flex items-center justify-between py-4 text-sm'>
              <span>{activeVoteBook} is still Draft -- requisitions can't be raised against it until it's Active.</span>
              <Button size='sm' onClick={() => activateVoteBook(activeVoteBook)} disabled={setVoteBookState.isPending}>Activate</Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && visibleLines.length === 0 && (
          <p className='text-sm text-muted-foreground'>No budget lines yet for this vote book.</p>
        )}

        <div className='grid gap-4 sm:grid-cols-2'>
          {visibleLines.map((line) => {
            const remaining = line.available_balance
            const spentPct = line.approved_budget > 0 ? Math.round((line.actual_spend / line.approved_budget) * 100) : 0
            const committedPct = line.approved_budget > 0 ? Math.round((line.committed_amount / line.approved_budget) * 100) : 0
            return (
              <Card key={line.name}>
                <CardHeader>
                  <CardTitle>{line.vote_code} — {line.description}</CardTitle>
                  <CardDescription>{line.fund.startsWith('Fund A') ? 'Fund A' : 'Fund B'} · {line.expense_account}{line.is_capital_project === 1 ? ' · Capital project' : ''}</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                    <div className='h-full bg-primary' style={{ width: `${Math.min(spentPct, 100)}%` }} />
                    <div className='-mt-2 h-full bg-amber-500/60' style={{ width: `${Math.min(committedPct, 100)}%`, marginLeft: `${Math.min(spentPct, 100)}%` }} />
                  </div>
                  <div className='grid grid-cols-3 gap-2 text-xs'>
                    <div><p className='text-muted-foreground'>Approved</p>{formatBudgetAmount(line.approved_budget, line.expense_account)}</div>
                    <div><p className='text-muted-foreground'>Committed</p>{formatBudgetAmount(line.committed_amount, line.expense_account)}</div>
                    <div><p className='text-muted-foreground'>Spent</p>{formatBudgetAmount(line.actual_spend, line.expense_account)}</div>
                  </div>
                  <p className='text-sm font-medium'>
                    {formatBudgetAmount(remaining, line.expense_account)} <span className='text-muted-foreground font-normal'>remaining</span>
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </Main>
    </>
  )
}
