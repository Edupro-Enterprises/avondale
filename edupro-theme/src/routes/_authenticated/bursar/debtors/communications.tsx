import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { MessagesSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useDebtorCases } from '@/lib/frappe/debtor-cases'
import { useStudents, useStudentGuardianLinks } from '@/lib/frappe/students'
import { useCommunications, useLogCommunication, type FrappeCommunicationLog } from '@/lib/frappe/communications'
import { useCommunicationTemplates, renderTemplate } from '@/lib/frappe/communication-templates'
import { formatUSD } from '@/lib/currency'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/bursar/debtors/communications')({
  component: CommunicationsPage,
})

const CHANNELS: FrappeCommunicationLog['channel'][] = ['Phone', 'SMS', 'Email', 'WhatsApp', 'In-Person', 'Letter']

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'channel', label: 'Channel', options: CHANNELS }]

function CommunicationsPage() {
  const { data: communications, isLoading, error } = useCommunications()
  const { data: debtorCases } = useDebtorCases()
  const { data: students } = useStudents()
  const { data: studentGuardianLinks } = useStudentGuardianLinks()
  const { data: templates } = useCommunicationTemplates()
  const logCommunication = useLogCommunication()
  const filters = useFilters('communications', FILTER_GROUPS)

  const [logOpen, setLogOpen] = useState(false)
  const [debtorCase, setDebtorCase] = useState('')
  const [directStudent, setDirectStudent] = useState('')
  const [channel, setChannel] = useState<FrappeCommunicationLog['channel']>('Phone')
  const [summary, setSummary] = useState('')
  const [templateId, setTemplateId] = useState('')

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students ?? []) map.set(s.name, formatStudentName(s.first_name, s.last_name))
    return map
  }, [students])

  const selectedCase = useMemo(() => (debtorCases ?? []).find((c) => c.name === debtorCase), [debtorCases, debtorCase])
  const caseStudent = selectedCase?.student

  function resetForm() {
    setDebtorCase('')
    setDirectStudent('')
    setChannel('Phone')
    setSummary('')
    setTemplateId('')
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = (templates ?? []).find((t) => t.name === id)
    if (!template || !selectedCase) return
    const { body } = renderTemplate(template, {
      studentName: studentNames.get(selectedCase.student) ?? selectedCase.student,
      amount: formatUSD(selectedCase.outstanding_amount),
      ageingBucket: selectedCase.ageing_bucket,
    })
    setChannel(template.channel)
    setSummary(body)
  }

  const directStudentGuardian = useMemo(
    () => studentGuardianLinks?.find((s) => s.name === directStudent)?.guardian,
    [studentGuardianLinks, directStudent]
  )

  const isDirty = debtorCase !== '' || directStudent !== '' || summary !== ''
  const guard = useUnsavedChangesGuard(isDirty, () => { setLogOpen(false); resetForm() })

  async function submit() {
    if (!summary.trim()) {
      toast.error('A summary is required.')
      return
    }
    if (!debtorCase && !directStudent) {
      toast.error('Pick a debtor case or a student to log this contact against.')
      return
    }
    // The backend requires a Parent Guardian (or Applicant) on every entry --
    // a bare debtor_case/student never satisfied that on its own, so a
    // student picked without one linked on file can't be logged here either.
    const parentGuardian = debtorCase ? selectedCase?.parent_guardian : directStudentGuardian
    if (!parentGuardian) {
      toast.error(debtorCase ? 'This debtor case has no Parent Guardian on file.' : 'This student has no Parent Guardian on file.')
      return
    }
    try {
      await logCommunication.mutateAsync({
        debtor_case: debtorCase || undefined,
        parent_guardian: parentGuardian,
        student: debtorCase ? caseStudent : directStudent,
        channel,
        summary: summary.trim(),
      })
      toast.success('Contact logged')
      setLogOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not log this contact.')
    }
  }

  const rows = useMemo(() => communications ?? [], [communications])
  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((c) => {
      const name = c.student ? studentNames.get(c.student) ?? c.student : ''
      return name.toLowerCase().includes(search) && (!filters.values.channel || c.channel === filters.values.channel)
    })
  }, [rows, studentNames, filters.search, filters.values])

  const columns: DataListColumn<FrappeCommunicationLog>[] = [
    {
      id: 'student',
      header: 'Student',
      sortable: true,
      sortValue: (c) => (c.student ? studentNames.get(c.student) ?? c.student : ''),
      className: 'min-w-32',
      cell: (c) => (c.student ? studentNames.get(c.student) ?? c.student : '—'),
    },
    { id: 'summary', header: 'Summary', className: 'min-w-64', cell: (c) => c.summary },
    { id: 'channel', header: 'Channel', sortable: true, sortValue: (c) => c.channel, cell: (c) => <StatusBadge tone='neutral'>{c.channel}</StatusBadge> },
    { id: 'date', header: 'Date', sortable: true, sortValue: (c) => c.logged_on, cell: (c) => c.logged_on },
    { id: 'loggedBy', header: 'Logged By', sortable: true, sortValue: (c) => c.logged_by, cell: (c) => c.logged_by },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Debtor Management</p>
            <h1 className='text-3xl font-bold tracking-tight'>Communications</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' asChild>
              <Link to='/bursar/debtors/templates'>Templates</Link>
            </Button>
            <Dialog open={logOpen} onOpenChange={(o) => (o ? setLogOpen(true) : guard.handleOpenChange(o))}>
              <DialogTrigger asChild>
                <Button><Plus className='h-4 w-4' />Log contact</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Log a contact</DialogTitle></DialogHeader>
                <div className='grid gap-4 py-2'>
                  <div className='grid gap-2'>
                    <Label htmlFor='case'>Debtor case (optional)</Label>
                    <Select value={debtorCase} onValueChange={(v) => { setDebtorCase(v); setDirectStudent('') }}>
                      <SelectTrigger id='case'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>
                        {(debtorCases ?? []).map((c) => <SelectItem key={c.name} value={c.name}>{studentNames.get(c.student) ?? c.student} — {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!debtorCase && (
                    <div className='grid gap-2'>
                      <Label htmlFor='direct-student'>Or a student with no debtor case</Label>
                      <Select value={directStudent} onValueChange={setDirectStudent}>
                        <SelectTrigger id='direct-student'><SelectValue placeholder='Select…' /></SelectTrigger>
                        <SelectContent>
                          {(students ?? []).map((s) => <SelectItem key={s.name} value={s.name}>{formatStudentName(s.first_name, s.last_name)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {directStudent && !directStudentGuardian && (
                        <p className='text-xs text-destructive'>No Parent Guardian on file for this student.</p>
                      )}
                    </div>
                  )}
                  {selectedCase && (templates ?? []).length > 0 && (
                    <div className='grid gap-2'>
                      <Label htmlFor='template'>Use template (optional)</Label>
                      <Select value={templateId} onValueChange={applyTemplate}>
                        <SelectTrigger id='template'><SelectValue placeholder='Compose from a template…' /></SelectTrigger>
                        <SelectContent>
                          {(templates ?? []).map((t) => <SelectItem key={t.name} value={t.name}>{t.template_name} ({t.channel})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className='grid gap-2'>
                    <Label htmlFor='channel'>Channel</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as FrappeCommunicationLog['channel'])}>
                      <SelectTrigger id='channel'><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='summary'>Summary</Label>
                    <Textarea id='summary' rows={4} placeholder='What was discussed?' value={summary} onChange={(e) => setSummary(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submit} disabled={logCommunication.isPending}>{logCommunication.isPending ? 'Logging…' : 'Log contact'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ConfirmDialog {...guard.discardDialogProps} />
          </div>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load communications from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Contact log</CardTitle>
                <CardDescription>Visible to Bursar, SDC, School Head and the District Auditor only.</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by student…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(c) => c.name}
              isLoading={isLoading}
              densityStorageKey='communications'
              emptyState={{
                icon: MessagesSquare,
                title: 'No contact entries found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Logged contacts will appear here.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
