import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MessageSquareText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import {
  useCommunicationTemplates,
  useCreateCommunicationTemplate,
  useDeleteCommunicationTemplate,
  type FrappeCommunicationTemplate,
  type TemplateChannel,
} from '@/lib/frappe/communication-templates'

export const Route = createFileRoute('/_authenticated/bursar/debtors/templates')({
  component: CommunicationTemplatesPage,
})

const CHANNELS: TemplateChannel[] = ['SMS', 'Email', 'Phone', 'In-Person']
const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'channel', label: 'Channel', options: CHANNELS }]

function CommunicationTemplatesPage() {
  const { data: templates, isLoading, error } = useCommunicationTemplates()
  const createTemplate = useCreateCommunicationTemplate()
  const deleteTemplate = useDeleteCommunicationTemplate()
  const filters = useFilters('communication-templates', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<TemplateChannel>('SMS')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [deleting, setDeleting] = useState<FrappeCommunicationTemplate | null>(null)

  function resetForm() {
    setName('')
    setChannel('SMS')
    setSubject('')
    setBody('')
  }

  const rows = useMemo(() => templates ?? [], [templates])
  const filtered = useMemo(
    () =>
      rows.filter(
        (t) => t.template_name.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.channel || t.channel === filters.values.channel)
      ),
    [rows, filters.search, filters.values]
  )

  async function handleCreate() {
    if (!name.trim() || !body.trim()) {
      toast.error('Name and body are required.')
      return
    }
    try {
      await createTemplate.mutateAsync({ template_name: name.trim(), channel, subject: subject.trim() || undefined, body: body.trim() })
      toast.success('Template added')
      setAddOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this template.')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteTemplate.mutateAsync(deleting.name)
      toast.success('Template deleted')
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not delete this template.')
    }
  }

  const columns: DataListColumn<FrappeCommunicationTemplate>[] = [
    {
      id: 'name',
      header: 'Template',
      sortable: true,
      sortValue: (t) => t.template_name,
      className: 'min-w-48',
      cell: (t) => (
        <div className='flex flex-col'>
          <span className='truncate'>{t.template_name}</span>
          <span className='truncate text-xs text-muted-foreground'>{t.subject ? `${t.subject} — ` : ''}{t.body}</span>
        </div>
      ),
    },
    {
      id: 'channel',
      header: 'Channel',
      sortable: true,
      sortValue: (t) => t.channel,
      cell: (t) => <StatusBadge tone='neutral'>{t.channel}</StatusBadge>,
    },
    {
      id: 'actions',
      header: '',
      cell: (t) => (
        <Button variant='ghost' size='icon' onClick={(e) => { e.stopPropagation(); setDeleting(t) }}>
          <Trash2 className='h-4 w-4 text-destructive' />
        </Button>
      ),
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Debtor Management</p>
            <h1 className='text-3xl font-bold tracking-tight'>Communication Templates</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a communication template</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Name' className='col-span-2'>
                  <Input className={compactControlClass} placeholder='Second reminder' value={name} onChange={(e) => setName(e.target.value)} />
                </CompactField>
                <CompactField label='Channel'>
                  <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Subject (email only)'>
                  <Input className={compactControlClass} placeholder='Optional' value={subject} onChange={(e) => setSubject(e.target.value)} />
                </CompactField>
                <CompactField label='Body' className='col-span-2'>
                  <Textarea
                    rows={4}
                    className='text-sm'
                    placeholder='Message text, with {studentName} / {amount} / {ageingBucket} placeholders'
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createTemplate.isPending}>
                  {createTemplate.isPending ? 'Adding…' : 'Add template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load templates from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All templates</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(t) => t.name}
              isLoading={isLoading}
              densityStorageKey='communication-templates'
              emptyState={{
                icon: MessageSquareText,
                title: 'No templates found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Templates will appear here once added.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Delete "${deleting?.template_name}"?`}
          desc='This template will no longer be available when composing a contact.'
          confirmText='Delete'
          destructive
          handleConfirm={handleDelete}
          className='sm:max-w-sm'
        />
      </Main>
    </>
  )
}
