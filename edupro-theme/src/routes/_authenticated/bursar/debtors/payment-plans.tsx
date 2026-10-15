import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { FrappeApiError } from '@/lib/frappe/client'
import { useDebtorCases } from '@/lib/frappe/debtor-cases'
import { useStudents } from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'
import {
  usePaymentPlans,
  useCreatePaymentPlan,
  useMarkInstallmentPaid,
  type NewInstallmentInput,
  type FrappePaymentPlan,
} from '@/lib/frappe/payment-plans'

export const Route = createFileRoute('/_authenticated/bursar/debtors/payment-plans')({
  component: PaymentPlansPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)
const planTone: Record<FrappePaymentPlan['status'], StatusTone> = { Active: 'info', Completed: 'good', Defaulted: 'bad', Cancelled: 'neutral' }
const installmentTone: Record<'Pending' | 'Paid' | 'Overdue', StatusTone> = { Paid: 'good', Pending: 'neutral', Overdue: 'bad' }

function PaymentPlansPage() {
  const { data: plans, isLoading, error } = usePaymentPlans()
  const { data: debtorCases } = useDebtorCases()
  const { data: students } = useStudents()
  const createPlan = useCreatePaymentPlan()
  const markPaid = useMarkInstallmentPaid()

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) map.set(s.name, formatStudentName(s.first_name, s.last_name))
    return map
  }, [students])
  const studentGrades = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) if (s.grade) map.set(s.name, s.grade)
    return map
  }, [students])

  const rows = useMemo(() => plans ?? [], [plans])
  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: ['Active', 'Completed', 'Defaulted', 'Cancelled'] },
      { key: 'grade', label: 'Grade', options: [...new Set(rows.map((p) => studentGrades.get(p.student)).filter((g): g is string => !!g))].sort() },
    ],
    [rows, studentGrades]
  )
  const filters = useFilters('payment-plans', filterGroups)
  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((plan) => {
      const studentName = studentNames.get(plan.student) ?? plan.student
      const matchesSearch = studentName.toLowerCase().includes(search) || plan.name.toLowerCase().includes(search)
      const matchesStatus = !filters.values.status || plan.status === filters.values.status
      const matchesGrade = !filters.values.grade || studentGrades.get(plan.student) === filters.values.grade
      return matchesSearch && matchesStatus && matchesGrade
    })
  }, [rows, studentNames, studentGrades, filters.search, filters.values])

  const [open, setOpen] = useState(false)
  const [debtorCase, setDebtorCase] = useState('')
  const [startDate, setStartDate] = useState(todayIso)
  const [installments, setInstallments] = useState<NewInstallmentInput[]>([{ due_date: '', amount: 0 }])

  const openCases = useMemo(() => (debtorCases ?? []).filter((c) => c.workflow_state === 'Open'), [debtorCases])
  const installmentsTotal = installments.reduce((sum, i) => sum + i.amount, 0)

  function resetForm() {
    setDebtorCase('')
    setStartDate(todayIso())
    setInstallments([{ due_date: '', amount: 0 }])
  }

  function updateInstallment(i: number, patch: Partial<NewInstallmentInput>) {
    setInstallments((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function submit() {
    const clean = installments.filter((i) => i.due_date && i.amount > 0)
    if (!debtorCase || clean.length === 0) {
      toast.error('Pick a debtor case and at least one complete installment.')
      return
    }
    try {
      const name = await createPlan.mutateAsync({ debtor_case: debtorCase, total_amount: installmentsTotal, start_date: startDate, installments: clean })
      toast.success(`${name} created`)
      setOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this payment plan.')
    }
  }

  async function handleMarkPaid(plan: FrappePaymentPlan, installmentName: string) {
    try {
      await markPaid.mutateAsync({ plan, installmentName, paidOn: todayIso() })
      toast.success('Installment marked paid')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this installment.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Debtor Management</p>
            <h1 className='text-3xl font-bold tracking-tight'>Payment Plans</h1>
          </div>
          <div className='flex items-center gap-2'>
            <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search by student or plan…' />
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />New payment plan</Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-md'>
              <DialogHeader><DialogTitle>Create a payment plan</DialogTitle></DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='debtor-case'>Debtor case</Label>
                  <Select value={debtorCase} onValueChange={setDebtorCase}>
                    <SelectTrigger id='debtor-case'><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>
                      {openCases.map((c) => <SelectItem key={c.name} value={c.name}>{studentNames.get(c.student) ?? c.student} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {openCases.length === 0 && <p className='text-xs text-muted-foreground'>No Open debtor cases available.</p>}
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='start-date'>Start date</Label>
                  <Input id='start-date' type='date' className='w-40' value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className='space-y-2'>
                  <Label>Installments</Label>
                  {installments.map((inst, i) => (
                    <div key={i} className='grid grid-cols-[1fr_1fr_auto] items-end gap-2'>
                      <Input type='date' value={inst.due_date} onChange={(e) => updateInstallment(i, { due_date: e.target.value })} />
                      <Input type='number' min='0' step='0.01' placeholder='Amount' value={inst.amount || ''} onChange={(e) => updateInstallment(i, { amount: Number(e.target.value) || 0 })} />
                      <Button type='button' variant='ghost' size='icon' onClick={() => setInstallments((prev) => prev.filter((_, idx) => idx !== i))} disabled={installments.length === 1}>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <div className='flex items-center justify-between'>
                    <Button type='button' variant='outline' size='sm' onClick={() => setInstallments((prev) => [...prev, { due_date: '', amount: 0 }])}>
                      Add installment
                    </Button>
                    <span className='text-sm font-medium'>Total: <Money usd={installmentsTotal} /></span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createPlan.isPending}>{createPlan.isPending ? 'Creating…' : 'Create plan'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load payment plans from the server. Try refreshing the page.</CardContent>
          </Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            {filters.activeCount > 0 ? 'No payment plans match your search or filters.' : 'No payment plans yet.'}
          </p>
        )}

        <div className='grid gap-4 lg:grid-cols-2'>
          {filtered.map((plan) => (
            <Card key={plan.name}>
              <CardHeader className='flex flex-row items-center justify-between'>
                <div>
                  <CardTitle>{studentNames.get(plan.student) ?? plan.student}</CardTitle>
                  <CardDescription>{plan.name} · <Money usd={plan.total_amount} compact /> total</CardDescription>
                </div>
                <StatusBadge tone={planTone[plan.status]}>{plan.status}</StatusBadge>
              </CardHeader>
              <CardContent className='divide-y'>
                {plan.installments.map((inst) => (
                  <div key={inst.name} className='flex items-center justify-between py-3'>
                    <p className='text-sm font-medium'>{inst.due_date}</p>
                    <div className='flex items-center gap-3'>
                      <Money usd={inst.amount} compact />
                      <StatusBadge tone={installmentTone[inst.status]}>{inst.status}</StatusBadge>
                      {inst.status !== 'Paid' && (
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleMarkPaid(plan, inst.name)}
                          disabled={markPaid.isPending}
                          title='Mark paid'
                          aria-label={`Mark ${inst.due_date} installment paid`}
                        >
                          <CheckCircle2 className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
