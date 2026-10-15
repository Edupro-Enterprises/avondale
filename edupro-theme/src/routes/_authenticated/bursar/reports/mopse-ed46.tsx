import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Eye, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { FrappeApiError } from '@/lib/frappe/client'
import { formatZiG } from '@/lib/currency'
import { useTerms } from '@/lib/frappe/terms'
import { viewServerPdf, downloadServerPdf } from '@/lib/print-reports'
import {
  useEd46Returns,
  useGenerateEd46Return,
  useCertifyEd46ReturnAsBursar,
  useUpdateEd46StaffingAnalysis,
  type FrappeEd46Return,
} from '@/lib/frappe/ed46-returns'

export const Route = createFileRoute('/_authenticated/bursar/reports/mopse-ed46')({
  component: MopseEd46ReportPage,
})

const GENERATE_ED46_PDF = 'edupro_school_fees.print_reports.api.generate_ed46_return_pdf'

const stateTone: Record<FrappeEd46Return['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending Certification': 'warning',
  Certified: 'good',
}

function MopseEd46ReportPage() {
  const { data: terms } = useTerms()
  const { data: returns, isLoading, error } = useEd46Returns()
  const generate = useGenerateEd46Return()
  const certifyAsBursar = useCertifyEd46ReturnAsBursar()
  const updateStaffing = useUpdateEd46StaffingAnalysis()

  const [genOpen, setGenOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [staffingText, setStaffingText] = useState('')

  const rows = useMemo(() => returns ?? [], [returns])
  const selected = rows.find((r) => r.name === selectedName) ?? null

  async function submitGenerate() {
    if (!term) {
      toast.error('Pick a term.')
      return
    }
    try {
      const name = await generate.mutateAsync(term)
      toast.success(`${name} generated`)
      setGenOpen(false)
      setTerm('')
      setSelectedName(name)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not generate this return.')
    }
  }

  async function handleCertify() {
    if (!selected) return
    try {
      await certifyAsBursar.mutateAsync(selected.name)
      toast.success('Certified as Bursar')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not certify this return.')
    }
  }

  async function saveStaffing() {
    if (!selected) return
    try {
      await updateStaffing.mutateAsync({ name: selected.name, text: staffingText })
      toast.success('Staffing analysis saved')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not save this text.')
    }
  }

  async function handleViewPdf(name: string) {
    try {
      await viewServerPdf(GENERATE_ED46_PDF, { name })
    } catch {
      toast.error('Could not open this return -- try Download PDF instead.')
    }
  }

  async function handleDownloadPdf(name: string) {
    try {
      await downloadServerPdf(GENERATE_ED46_PDF, { name }, `${name}.pdf`)
    } catch {
      toast.error('Could not generate this return.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>MoPSE ED46 Return</h1>
            <p className='text-sm text-muted-foreground'>Snapshot generated per term from School Setup and posted revenue/enrolment figures.</p>
          </div>
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button variant='outline'><Plus className='h-4 w-4' />Generate return</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate an ED46 return</DialogTitle></DialogHeader>
              <div className='grid gap-2 py-2'>
                <Select value={term} onValueChange={setTerm}>
                  <SelectTrigger><SelectValue placeholder='Select a term…' /></SelectTrigger>
                  <SelectContent>{(terms ?? []).map((t) => <SelectItem key={t.name} value={t.name}>{t.term_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={submitGenerate} disabled={generate.isPending}>{generate.isPending ? 'Generating…' : 'Generate'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/mopse-ed46' />

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load ED46 returns from the server. Try refreshing the page.</CardContent>
          </Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
        {!isLoading && rows.length === 0 && <p className='text-sm text-muted-foreground'>No returns generated yet.</p>}

        <div className='grid gap-4'>
          {rows.map((r) => (
            <Card key={r.name} className={selected?.name === r.name ? 'ring-2 ring-primary' : ''}>
              <CardHeader className='cursor-pointer' onClick={() => { setSelectedName(r.name); setStaffingText(r.staffing_support_analysis ?? '') }}>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle>{r.term}</CardTitle>
                    <CardDescription>{r.school_name} · EMIS {r.emis_number} · {r.region}</CardDescription>
                  </div>
                  <StatusBadge tone={stateTone[r.workflow_state]}>{r.workflow_state}</StatusBadge>
                </div>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-muted-foreground'>Total enrolment</p>
                  <p className='text-sm font-medium'>{r.total_enrolment}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Revenue billed / realized</p>
                  <p className='text-sm font-medium tabular-nums'>{formatZiG(r.total_revenue_billed)} / {formatZiG(r.total_revenue_realized)}</p>
                </div>
                <div className='flex gap-3 text-xs'>
                  <span className={r.bursar_certified ? 'text-emerald-600' : 'text-muted-foreground'}>Bursar {r.bursar_certified ? '✓' : '—'}</span>
                  <span className={r.school_head_certified ? 'text-emerald-600' : 'text-muted-foreground'}>School Head {r.school_head_certified ? '✓' : '—'}</span>
                  <span className={r.sdc_certified ? 'text-emerald-600' : 'text-muted-foreground'}>SDC {r.sdc_certified ? '✓' : '—'}</span>
                </div>
              </CardContent>
              {selectedName === r.name && (
                <CardContent className='space-y-3 border-t pt-4'>
                  <div className='grid gap-2'>
                    <label className='text-xs font-medium text-muted-foreground' htmlFor={`staffing-${r.name}`}>Staffing support analysis</label>
                    <Textarea id={`staffing-${r.name}`} rows={3} value={staffingText} onChange={(e) => setStaffingText(e.target.value)} disabled={r.workflow_state === 'Certified'} />
                    {r.workflow_state !== 'Certified' && (
                      <Button size='sm' variant='outline' className='w-fit' onClick={saveStaffing} disabled={updateStaffing.isPending}>
                        {updateStaffing.isPending ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {!r.bursar_certified && (
                      <Button size='sm' onClick={handleCertify} disabled={certifyAsBursar.isPending}>
                        {certifyAsBursar.isPending ? 'Certifying…' : 'Certify as Bursar'}
                      </Button>
                    )}
                    <Button size='sm' variant='outline' onClick={() => handleViewPdf(r.name)}>
                      <Eye className='h-4 w-4' />
                      View
                    </Button>
                    <Button size='sm' variant='outline' onClick={() => handleDownloadPdf(r.name)}>
                      <Download className='h-4 w-4' />
                      Download PDF
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
