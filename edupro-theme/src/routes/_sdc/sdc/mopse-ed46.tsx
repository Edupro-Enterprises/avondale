import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Download, Eye, FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SdcHeader } from '@/components/layout/sdc-header'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { formatZiG } from '@/lib/currency'
import { FrappeApiError } from '@/lib/frappe/client'
import { viewServerPdf, downloadServerPdf } from '@/lib/print-reports'
import { useEd46Returns, useCertifyEd46ReturnAsSdcChair, type FrappeEd46Return } from '@/lib/frappe/ed46-returns'

export const Route = createFileRoute('/_sdc/sdc/mopse-ed46')({
  component: SdcEd46Page,
})

const GENERATE_ED46_PDF = 'edupro_school_fees.print_reports.api.generate_ed46_return_pdf'

const stateTone: Record<FrappeEd46Return['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending Certification': 'warning',
  Certified: 'good',
}

function SdcEd46Page() {
  const { data: returns, isLoading, error } = useEd46Returns()
  const certifyAsSdcChair = useCertifyEd46ReturnAsSdcChair()
  const [pending, setPending] = useState<string | null>(null)

  const rows = useMemo(() => returns ?? [], [returns])

  async function handleCertify(name: string) {
    setPending(name)
    try {
      await certifyAsSdcChair.mutateAsync(name)
      toast.success('Certified as SDC Chairperson')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not certify this return.')
    } finally {
      setPending(null)
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
      <SdcHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>MoPSE ED46 Return</h1>
          <p className='text-sm text-muted-foreground'>All three sign-offs (Bursar, School Head, SDC) are required, in any order, before a return counts as Certified.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load ED46 returns from the server. Try refreshing the page.</CardContent>
          </Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
        {!isLoading && rows.length === 0 && <p className='text-sm text-muted-foreground'>No returns generated yet -- the Bursar generates one per term.</p>}

        <div className='grid gap-4'>
          {rows.map((r) => (
            <Card key={r.name}>
              <CardHeader>
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
                <div className='flex gap-3 text-xs sm:col-span-2'>
                  <span className={r.bursar_certified ? 'text-emerald-600' : 'text-muted-foreground'}>Bursar {r.bursar_certified ? '✓' : '—'}</span>
                  <span className={r.school_head_certified ? 'text-emerald-600' : 'text-muted-foreground'}>School Head {r.school_head_certified ? '✓' : '—'}</span>
                  <span className={r.sdc_certified ? 'text-emerald-600' : 'text-muted-foreground'}>SDC {r.sdc_certified ? '✓' : '—'}</span>
                </div>
              </CardContent>
              <CardContent className='flex flex-wrap gap-2 border-t pt-4'>
                {!r.sdc_certified && (
                  <Button size='sm' onClick={() => handleCertify(r.name)} disabled={certifyAsSdcChair.isPending && pending === r.name}>
                    <FileCheck2 className='h-4 w-4' />
                    {certifyAsSdcChair.isPending && pending === r.name ? 'Certifying…' : 'Certify as SDC Chairperson'}
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
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
