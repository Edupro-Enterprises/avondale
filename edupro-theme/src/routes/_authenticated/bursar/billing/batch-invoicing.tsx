import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Eye, Mail, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { Money } from '@/components/money'
import { FrappeApiError, api } from '@/lib/frappe/client'
import { useFeeStructures } from '@/lib/frappe/fee-structures'
import { useRunBatchInvoicing, useEmailInvoices, type BatchInvoicingResult } from '@/lib/frappe/invoices'
import { useStudents } from '@/lib/frappe/students'
import { useDocumentLetterhead } from '@/lib/frappe/school-setup'
import { openReportPdf, type PdfLetterhead } from '@/lib/export'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/bursar/billing/batch-invoicing')({
  component: BatchInvoicingPage,
})

interface InvoiceDetailForPdf {
  name: string
  term: string
  total_amount: number
  items: Array<{ fee_item: string; description?: string; amount: number }>
}

async function viewInvoicePdf(invoiceName: string, studentName: string, letterhead: PdfLetterhead) {
  const detail = (await api.get<{ data: InvoiceDetailForPdf }>(`/api/resource/Invoice/${encodeURIComponent(invoiceName)}`)).data
  await openReportPdf(
    `Invoice ${invoiceName}`,
    letterhead,
    `${studentName} · ${detail.term} · Generated ${new Date().toISOString().slice(0, 10)}`,
    [
      {
        columns: ['Description', 'Amount (USD)'],
        rows: detail.items.map((i) => [i.description || i.fee_item, i.amount.toFixed(2)]),
      },
    ],
    undefined,
    { label: 'Total Amount', value: `$${detail.total_amount.toFixed(2)}` }
  )
}

function BatchInvoicingPage() {
  const { data: feeStructures, isLoading } = useFeeStructures()
  const { data: students } = useStudents()
  const letterhead = useDocumentLetterhead()
  const runBatch = useRunBatchInvoicing()
  const emailInvoices = useEmailInvoices()

  const [openName, setOpenName] = useState<string | null>(null)
  const [grade, setGrade] = useState<string>('')
  const [result, setResult] = useState<BatchInvoicingResult | null>(null)
  const [emailingAll, setEmailingAll] = useState(false)
  const [emailingOne, setEmailingOne] = useState<string | null>(null)

  const approved = (feeStructures ?? []).filter((fs) => fs.workflow_state === 'Approved')
  const streams = useMemo(
    () => [...new Set((students ?? []).map((s) => s.grade).filter((g): g is string => !!g))].sort(),
    [students]
  )
  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) map.set(s.name, formatStudentName(s.first_name, s.last_name))
    return map
  }, [students])
  const eligibleCount = grade ? (students ?? []).filter((s) => s.grade === grade).length : (students ?? []).length

  function openDialog(name: string) {
    setGrade('')
    setResult(null)
    setOpenName(name)
  }

  async function runBatchInvoicing(fs: { name: string; structure_name: string }) {
    try {
      const res = await runBatch.mutateAsync({ feeStructure: fs.name, grade: grade || undefined })
      setResult(res)
      if (res.created.length > 0) toast.success(`${res.created.length} invoice${res.created.length === 1 ? '' : 's'} raised against ${fs.structure_name}`)
      else toast.info('No new invoices -- every eligible student already has one against this fee structure.')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not run batch invoicing.')
    }
  }

  async function handleEmailAll() {
    if (!result) return
    setEmailingAll(true)
    try {
      const res = await emailInvoices.mutateAsync(result.created.map((c) => c.invoice))
      toast.success(
        `Emailed ${res.sent.length} of ${result.created.length} invoice${result.created.length === 1 ? '' : 's'}` +
          (res.skipped_no_guardian_email.length > 0 ? ` (${res.skipped_no_guardian_email.length} skipped -- no guardian email on file)` : '')
      )
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not email these invoices.')
    } finally {
      setEmailingAll(false)
    }
  }

  async function handleEmailOne(invoiceName: string) {
    setEmailingOne(invoiceName)
    try {
      const res = await emailInvoices.mutateAsync([invoiceName])
      if (res.sent.length > 0) toast.success(`${invoiceName} emailed`)
      else toast.error('No guardian email on file for this student.')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not email this invoice.')
    } finally {
      setEmailingOne(null)
    }
  }

  async function handleViewOne(invoiceName: string, studentId: string) {
    try {
      await viewInvoicePdf(invoiceName, studentNames.get(studentId) ?? studentId, letterhead)
    } catch {
      toast.error('Could not open this invoice.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Billing</p>
          <h1 className='text-3xl font-bold tracking-tight'>Batch Invoicing</h1>
          <p className='text-sm text-muted-foreground'>Run an approved fee structure against every eligible student at once.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          {approved.map((fs) => (
            <Card key={fs.name}>
              <CardHeader>
                <CardTitle>{fs.structure_name}</CardTitle>
                <CardDescription>{fs.academic_year} · {fs.term}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='mb-4 grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Eligible students</p>
                    <p className='text-lg font-bold tabular-nums'>{(students ?? []).length === 0 ? '—' : eligibleCount}</p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Estimated total value</p>
                    <p className='text-lg font-bold'><Money usd={eligibleCount * fs.total_amount} compact /></p>
                  </div>
                </div>
                <p className='mb-4 text-sm text-muted-foreground'>
                  Students already invoiced against this fee structure are skipped automatically.
                </p>
                <Dialog open={openName === fs.name} onOpenChange={(o) => (o ? openDialog(fs.name) : setOpenName(null))}>
                  <DialogTrigger asChild>
                    <Button>
                      <PlayCircle className='h-4 w-4' />
                      Run batch
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='sm:max-w-lg'>
                    <DialogHeader>
                      <DialogTitle>Run batch invoicing</DialogTitle>
                      <DialogDescription>
                        This raises one invoice per eligible student against <strong>{fs.structure_name}</strong>.
                        Already-invoiced students are skipped, so this is safe to re-run.
                      </DialogDescription>
                    </DialogHeader>
                    {!result ? (
                      <div className='grid gap-2'>
                        <Label htmlFor='grade'>Class / Stream (optional -- leave blank for every class)</Label>
                        <Select value={grade} onValueChange={setGrade}>
                          <SelectTrigger id='grade'><SelectValue placeholder='All classes' /></SelectTrigger>
                          <SelectContent>
                            {streams.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className='text-xs text-muted-foreground'>
                          {eligibleCount} student{eligibleCount === 1 ? '' : 's'} will be invoiced, estimated <Money usd={eligibleCount * fs.total_amount} compact />.
                        </p>
                      </div>
                    ) : (
                      <div className='grid gap-3 text-sm'>
                        <div className='flex items-center justify-between'>
                          <div>
                            <p><strong>{result.created.length}</strong> invoice{result.created.length === 1 ? '' : 's'} raised</p>
                            <p className='text-muted-foreground'>{result.skipped_existing.length} already invoiced, skipped</p>
                          </div>
                          {result.created.length > 0 && (
                            <Button size='sm' variant='outline' onClick={handleEmailAll} disabled={emailingAll}>
                              <Mail className='h-4 w-4' />
                              {emailingAll ? 'Emailing…' : 'Email all'}
                            </Button>
                          )}
                        </div>
                        {result.failed.length > 0 && (
                          <p className='text-destructive'>{result.failed.length} failed -- {result.failed[0].student}: {result.failed[0].error}</p>
                        )}
                        {result.created.length > 0 && (
                          <div className='max-h-56 divide-y overflow-y-auto rounded-md border'>
                            {result.created.map(({ invoice, student }) => (
                              <div key={invoice} className='flex items-center justify-between px-3 py-2'>
                                <div>
                                  <p className='font-medium'>{invoice}</p>
                                  <p className='text-xs text-muted-foreground'>{studentNames.get(student) ?? student}</p>
                                </div>
                                <div className='flex items-center gap-1'>
                                  <Button size='sm' variant='ghost' onClick={() => handleViewOne(invoice, student)}>
                                    <Eye className='h-3.5 w-3.5' />
                                  </Button>
                                  <Button size='sm' variant='ghost' disabled={emailingOne === invoice} onClick={() => handleEmailOne(invoice)}>
                                    <Mail className='h-3.5 w-3.5' />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <DialogFooter>
                      {!result ? (
                        <Button onClick={() => runBatchInvoicing(fs)} disabled={runBatch.isPending}>
                          {runBatch.isPending ? 'Running…' : 'Confirm and run'}
                        </Button>
                      ) : (
                        <Button onClick={() => setOpenName(null)}>Done</Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && approved.length === 0 && (
          <div className='py-12 text-center'>
            <StatusBadge tone='neutral'>No approved fee structures ready to invoice yet</StatusBadge>
          </div>
        )}
      </Main>
    </>
  )
}
