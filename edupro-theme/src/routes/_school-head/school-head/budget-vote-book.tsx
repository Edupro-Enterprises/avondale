import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { formatZiG } from '@/lib/currency'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAccounts } from '@/lib/frappe/accounts'
import { useBudgetVoteBooks, useBudgetLines, useSetBudgetVoteBookState } from '@/lib/frappe/budget-lines'

export const Route = createFileRoute('/_school-head/school-head/budget-vote-book')({
  component: BudgetVoteBookPage,
})

function BudgetVoteBookPage() {
  const { data: voteBooks } = useBudgetVoteBooks()
  const { data: budgetLines, isLoading, error } = useBudgetLines()
  const { data: accounts } = useAccounts()
  const setVoteBookState = useSetBudgetVoteBookState()

  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  function formatBudgetAmount(amount: number, expenseAccount: string) {
    return accountCurrency.get(expenseAccount) === 'USD' ? <Money usd={amount} compact /> : formatZiG(amount)
  }

  const [selectedVoteBook, setSelectedVoteBook] = useState<string | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [activateOpen, setActivateOpen] = useState(false)

  const activeVoteBook = selectedVoteBook ?? (voteBooks ?? []).find((v) => v.workflow_state === 'Active')?.name ?? (voteBooks ?? [])[0]?.name
  const activeVoteBookState = (voteBooks ?? []).find((v) => v.name === activeVoteBook)?.workflow_state
  const visibleLines = useMemo(
    () => (budgetLines ?? []).filter((l) => !activeVoteBook || l.budget_vote_book === activeVoteBook),
    [budgetLines, activeVoteBook]
  )

  async function closeVoteBook() {
    if (!activeVoteBook) return
    try {
      await setVoteBookState.mutateAsync({ name: activeVoteBook, workflow_state: 'Closed' })
      toast.success(`${activeVoteBook} closed`)
      setCloseOpen(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not close this vote book.')
    }
  }

  async function activateVoteBook() {
    if (!activeVoteBook) return
    try {
      await setVoteBookState.mutateAsync({ name: activeVoteBook, workflow_state: 'Active' })
      toast.success(`${activeVoteBook} activated`)
      setActivateOpen(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not activate this vote book.')
    }
  }

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Budget Vote Book</h1>
            <p className='text-sm text-muted-foreground'>The current academic year's budget must be Active before requisitions can commit against it.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Select value={activeVoteBook ?? ''} onValueChange={setSelectedVoteBook}>
              <SelectTrigger className='w-56'><SelectValue placeholder='Select a vote book' /></SelectTrigger>
              <SelectContent>
                {(voteBooks ?? []).map((v) => <SelectItem key={v.name} value={v.name}>{v.academic_year} ({v.workflow_state})</SelectItem>)}
              </SelectContent>
            </Select>
            <ConfirmDialog
              open={closeOpen}
              onOpenChange={setCloseOpen}
              title={`Close ${activeVoteBook}?`}
              desc='This locks all prior postings and cannot be undone from here.'
              confirmText='Confirm close'
              destructive
              handleConfirm={closeVoteBook}
              isLoading={setVoteBookState.isPending}
              className='sm:max-w-sm'
            />
            <ConfirmDialog
              open={activateOpen}
              onOpenChange={setActivateOpen}
              title={`Activate ${activeVoteBook}?`}
              desc='Requisitions can only commit against an Active vote book. This does not affect any other vote book.'
              confirmText='Confirm activate'
              handleConfirm={activateVoteBook}
              isLoading={setVoteBookState.isPending}
              className='sm:max-w-sm'
            />
            <Button variant='outline' disabled={!activeVoteBook || activeVoteBookState !== 'Draft'} onClick={() => setActivateOpen(true)}>
              <Unlock className='h-4 w-4' />
              Activate
            </Button>
            <Button variant='outline' disabled={!activeVoteBook || activeVoteBookState !== 'Active'} onClick={() => setCloseOpen(true)}>
              <Lock className='h-4 w-4' />
              Close period
            </Button>
          </div>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load budget lines from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        {!isLoading && visibleLines.length === 0 && (
          <p className='text-sm text-muted-foreground'>No budget lines yet for this vote book.</p>
        )}

        <div className='grid gap-4 sm:grid-cols-2'>
          {visibleLines.map((line) => {
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
                    {formatBudgetAmount(line.available_balance, line.expense_account)} <span className='text-muted-foreground font-normal'>remaining</span>
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
