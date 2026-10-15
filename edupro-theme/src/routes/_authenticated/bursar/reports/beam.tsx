import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { StatusBadge } from '@/components/status-badge'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { FrappeApiError } from '@/lib/frappe/client'
import { Money } from '@/components/money'
import { useStudents } from '@/lib/frappe/students'
import { useBeamReconciliation, useCreateBeamClaim, useRecordBeamDisbursement } from '@/lib/frappe/beam-claims'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/bursar/reports/beam')({
  component: BeamReconciliationPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

function BeamReconciliationPage() {
  const { data: students } = useStudents()
  const { data: reconciliation, isLoading, error } = useBeamReconciliation()
  const createClaim = useCreateBeamClaim()
  const recordDisbursement = useRecordBeamDisbursement()

  const beamStudents = useMemo(() => (students ?? []).filter((s) => s.beneficiary_category === 'BEAM'), [students])
  const terms = useMemo(() => [...new Set((students ?? []).map((s) => s.current_term).filter((t): t is string => !!t))], [students])

  const [newOpen, setNewOpen] = useState(false)
  const [student, setStudent] = useState('')
  const [term, setTerm] = useState('')
  const [tuitionArrears, setTuitionArrears] = useState('')
  const [sdcLevyArrears, setSdcLevyArrears] = useState('')

  const [disbursing, setDisbursing] = useState<string | null>(null)
  const [disbursementAmount, setDisbursementAmount] = useState('')
  const [disbursementReference, setDisbursementReference] = useState('')

  function resetNewForm() {
    setStudent('')
    setTerm('')
    setTuitionArrears('')
    setSdcLevyArrears('')
  }

  async function submitClaim() {
    if (!student || !term) {
      toast.error('Student and term are required.')
      return
    }
    try {
      const name = await createClaim.mutateAsync({
        student, term, claim_date: todayIso(),
        tuition_arrears_claimed: Number(tuitionArrears) || 0,
        sdc_levy_arrears_claimed: Number(sdcLevyArrears) || 0,
      })
      toast.success(`${name} logged`)
      setNewOpen(false)
      resetNewForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not log this claim.')
    }
  }

  async function submitDisbursement() {
    if (!disbursing || !disbursementAmount) return
    try {
      await recordDisbursement.mutateAsync({ name: disbursing, amount: Number(disbursementAmount), reference: disbursementReference || undefined })
      toast.success('Disbursement recorded')
      setDisbursing(null)
      setDisbursementAmount('')
      setDisbursementReference('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not record this disbursement.')
    }
  }

  const rows = reconciliation?.rows ?? []
  const totals = reconciliation?.totals

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>BEAM Reconciliation</h1>
            <p className='text-sm text-muted-foreground'>Matches Treasury disbursements against what each beneficiary has claimed.</p>
          </div>
          <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (o) resetNewForm() }}>
            <DialogTrigger asChild>
              <Button variant='outline'><Plus className='h-4 w-4' />Log claim</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log a BEAM claim</DialogTitle></DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='student'>Student</Label>
                  <Select value={student} onValueChange={setStudent}>
                    <SelectTrigger id='student'><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{beamStudents.map((s) => <SelectItem key={s.name} value={s.name}>{formatStudentName(s.first_name, s.last_name)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='term'>Term</Label>
                  <Select value={term} onValueChange={setTerm}>
                    <SelectTrigger id='term'><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{terms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='tuition'>Tuition arrears claimed</Label>
                    <Input id='tuition' type='number' min='0' step='0.01' value={tuitionArrears} onChange={(e) => setTuitionArrears(e.target.value)} />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='levy'>SDC levy arrears claimed</Label>
                    <Input id='levy' type='number' min='0' step='0.01' value={sdcLevyArrears} onChange={(e) => setSdcLevyArrears(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitClaim} disabled={createClaim.isPending}>{createClaim.isPending ? 'Logging…' : 'Log claim'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/beam' />

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load the BEAM reconciliation from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <div className='mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader><CardTitle className='text-sm text-muted-foreground'>Tuition claimed</CardTitle></CardHeader>
            <CardContent className='text-2xl font-bold tabular-nums'><Money usd={totals?.total_tuition_claimed ?? 0} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className='text-sm text-muted-foreground'>SDC levy claimed</CardTitle></CardHeader>
            <CardContent className='text-2xl font-bold tabular-nums'><Money usd={totals?.total_sdc_levy_claimed ?? 0} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className='text-sm text-muted-foreground'>Disbursed</CardTitle></CardHeader>
            <CardContent className='text-2xl font-bold tabular-nums'><Money usd={totals?.total_disbursed ?? 0} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className='text-sm text-muted-foreground'>Unpaid</CardTitle></CardHeader>
            <CardContent className='text-2xl font-bold tabular-nums'><Money usd={totals?.total_unpaid ?? 0} /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>BEAM claims</CardTitle><CardDescription>{rows.length} claims on record</CardDescription></CardHeader>
          <CardContent className='pt-0'>
            {isLoading && <p className='py-4 text-sm text-muted-foreground'>Loading…</p>}
            <div className='divide-y'>
              {rows.map((r) => (
                <div key={r.name} className='flex items-center justify-between gap-4 py-3'>
                  <div>
                    <p className='text-sm font-medium'>{r.student_name}</p>
                    <p className='text-xs text-muted-foreground'>{r.name} · {r.grade ?? 'No grade'} · {r.term}</p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <div className='text-right text-xs text-muted-foreground'>
                      Claimed <Money usd={r.tuition_arrears_claimed + r.sdc_levy_arrears_claimed} compact /> · Disbursed <Money usd={r.treasury_amount_disbursed} compact />
                    </div>
                    <StatusBadge tone={r.unpaid_claim <= 0 ? 'good' : 'warning'}>
                      {r.unpaid_claim <= 0 ? 'Fully matched' : <>Awaiting <Money usd={r.unpaid_claim} compact /></>}
                    </StatusBadge>
                    {r.unpaid_claim > 0 && (
                      <Button size='sm' variant='outline' onClick={() => { setDisbursing(r.name); setDisbursementAmount(String(r.treasury_amount_disbursed + r.unpaid_claim)) }}>
                        Record disbursement
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!disbursing} onOpenChange={(o) => !o && setDisbursing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record disbursement for {disbursing}</DialogTitle></DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='grid gap-2'>
                <Label htmlFor='amount'>Treasury amount disbursed (cumulative)</Label>
                <Input id='amount' type='number' min='0' step='0.01' value={disbursementAmount} onChange={(e) => setDisbursementAmount(e.target.value)} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='reference'>Disbursement reference (optional)</Label>
                <Input id='reference' value={disbursementReference} onChange={(e) => setDisbursementReference(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitDisbursement} disabled={recordDisbursement.isPending}>{recordDisbursement.isPending ? 'Saving…' : 'Record disbursement'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
