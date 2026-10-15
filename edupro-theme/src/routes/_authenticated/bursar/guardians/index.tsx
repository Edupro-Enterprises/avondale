import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Contact, Eye, Plus, Send, Upload, UserSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { ReportActions } from '@/components/report-actions'
import { ImportDialog } from '@/components/import-dialog'
import { FrappeApiError } from '@/lib/frappe/client'
import {
  useAllGuardians,
  useCreateGuardian,
  useCreatePortalInvitation,
  useStudentGuardianLinks,
  type FrappeGuardian,
  type NewGuardianInput,
  type PortalInvitationResult,
} from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/bursar/guardians/')({
  component: GuardiansPage,
})

interface LinkedStudent {
  name: string
  fullName: string
  grade?: string
}

function GuardianDetailDialog({ guardian, linkedStudents, onClose }: { guardian: FrappeGuardian; linkedStudents: LinkedStudent[]; onClose: () => void }) {
  const createInvitation = useCreatePortalInvitation()
  const [issued, setIssued] = useState<PortalInvitationResult | null>(null)
  const inviteUrl = issued ? `${window.location.origin}/invite/${issued.token}` : null

  async function invite() {
    try {
      const result = await createInvitation.mutateAsync(guardian.name)
      setIssued(result)
      toast.success(`Invitation sent by ${result.delivery_channel} to ${result.delivery_target}`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this invitation.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{guardian.full_name}</DialogTitle>
        </DialogHeader>
        <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
          <div><p className='text-xs text-muted-foreground'>Relationship</p><p>{guardian.relationship || '—'}</p></div>
          <div><p className='text-xs text-muted-foreground'>National ID</p><p>{guardian.national_id || '—'}</p></div>
          <div><p className='text-xs text-muted-foreground'>Employer</p><p>{guardian.employer || '—'}</p></div>
          <div><p className='text-xs text-muted-foreground'>Address</p><p>{guardian.address || '—'}</p></div>
          <div><p className='text-xs text-muted-foreground'>Email</p><p>{guardian.email || '—'}</p></div>
          <div><p className='text-xs text-muted-foreground'>Phone</p><p>{guardian.phone_number || '—'}</p></div>
          <div className='col-span-2'>
            <p className='text-xs text-muted-foreground'>Portal access</p>
            {guardian.user ? (
              <p>Linked to {guardian.user}</p>
            ) : (
              <div className='mt-1 flex items-center gap-2'>
                <Button size='sm' variant='outline' disabled={createInvitation.isPending || (!guardian.phone_number && !guardian.email)} onClick={invite}>
                  <Send className='h-3.5 w-3.5' />
                  {createInvitation.isPending ? 'Sending…' : 'Invite to portal'}
                </Button>
                {!guardian.phone_number && !guardian.email && (
                  <span className='text-xs text-muted-foreground'>No phone or email on file to invite through.</span>
                )}
              </div>
            )}
            {issued && inviteUrl && (
              <p className='mt-2 rounded-md border bg-muted/50 px-2 py-1.5 text-xs break-all'>
                Link (relay this if {issued.delivery_channel.toLowerCase()} delivery didn't reach them): {inviteUrl}
              </p>
            )}
          </div>
        </div>
        <div>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>Linked students</p>
          <div className='divide-y rounded-md border'>
            {linkedStudents.length === 0 && <p className='px-3 py-2 text-sm text-muted-foreground'>No students linked yet.</p>}
            {linkedStudents.map((s) => (
              <Link key={s.name} to='/bursar/students/$studentId' params={{ studentId: s.name }} search={{ tab: undefined }} className='flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50'>
                <span>{s.fullName}</span>
                <span className='text-xs text-muted-foreground'>{s.grade}</span>
              </Link>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const FILTER_GROUPS: FilterGroupDef[] = [
  { key: 'portal', label: 'Portal Access', options: ['Enabled', 'Disabled'] },
]

function GuardiansPage() {
  const { data: guardians, isLoading, error } = useAllGuardians()
  const { data: studentLinks } = useStudentGuardianLinks()
  const createGuardian = useCreateGuardian()
  const filters = useFilters('guardians', FILTER_GROUPS)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewing, setViewing] = useState<FrappeGuardian | null>(null)

  const [newFullName, setNewFullName] = useState('')
  const [newRelationship, setNewRelationship] = useState<NewGuardianInput['relationship']>('Father')
  const [newNationalId, setNewNationalId] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const linkedStudentsByGuardian = useMemo(() => {
    const map = new Map<string, LinkedStudent[]>()
    for (const s of studentLinks ?? []) {
      const entry: LinkedStudent = { name: s.name, fullName: formatStudentName(s.first_name, s.last_name), grade: s.grade }
      for (const guardianName of [s.guardian, s.secondary_guardian]) {
        if (!guardianName) continue
        const list = map.get(guardianName) ?? []
        list.push(entry)
        map.set(guardianName, list)
      }
    }
    return map
  }, [studentLinks])

  const filtered = useMemo(() => {
    const { search, values } = filters
    return (guardians ?? []).filter((g) => {
      const matchesSearch = g.full_name.toLowerCase().includes(search.toLowerCase()) || (g.phone_number ?? '').includes(search)
      const matchesPortal = !values.portal || (values.portal === 'Enabled' ? !!g.user : !g.user)
      return matchesSearch && matchesPortal
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardians, filters.search, filters.values])

  const reportRows = useMemo(
    () => filtered.map((g) => [g.name, g.full_name, g.relationship ?? '', g.phone_number ?? '', g.email ?? '', g.user ? 'Enabled' : 'Disabled']),
    [filtered]
  )

  const columns: DataListColumn<FrappeGuardian>[] = [
    { id: 'name', header: 'Guardian', sortable: true, sortValue: (g) => g.full_name, className: 'min-w-40', cell: (g) => g.full_name },
    { id: 'relationship', header: 'Relationship', sortable: true, sortValue: (g) => g.relationship ?? '', cell: (g) => g.relationship || '—' },
    { id: 'phone', header: 'Phone', sortable: true, sortValue: (g) => g.phone_number ?? '', cell: (g) => g.phone_number || '—' },
    {
      id: 'linked',
      header: 'Students',
      sortable: true,
      sortValue: (g) => (linkedStudentsByGuardian.get(g.name) ?? []).length,
      cell: (g) => {
        const count = (linkedStudentsByGuardian.get(g.name) ?? []).length
        return `${count} student${count === 1 ? '' : 's'}`
      },
    },
    {
      id: 'portal',
      header: 'Portal Access',
      sortable: true,
      sortValue: (g) => (g.user ? 1 : 0),
      cell: (g) => (
        <StatusBadge tone={g.user ? 'good' : 'neutral'}>
          {g.user ? 'Enabled' : 'Disabled'}
        </StatusBadge>
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-8',
      cell: (g) => (
        <Button variant='ghost' size='icon' className='h-7! w-7!' onClick={(e) => { e.stopPropagation(); setViewing(g) }} aria-label={`View ${g.full_name}`}>
          <Eye className='h-4 w-4' />
        </Button>
      ),
    },
  ]

  function resetAddForm() {
    setNewFullName('')
    setNewRelationship('Father')
    setNewNationalId('')
    setNewPhone('')
    setNewEmail('')
  }

  async function handleAddGuardian() {
    if (!newFullName.trim()) {
      toast.error('Full name is required.')
      return
    }
    try {
      await createGuardian.mutateAsync({
        full_name: newFullName.trim(),
        relationship: newRelationship,
        national_id: newNationalId.trim() || undefined,
        phone_number: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      })
      toast.success('Guardian added')
      resetAddForm()
      setAddOpen(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this guardian.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600'>
              <Contact className='h-5 w-5' />
            </div>
            <div>
              <p className='mb-1 text-sm font-medium text-primary'>Enrollment</p>
              <h1 className='text-3xl font-bold tracking-tight'>Guardians</h1>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <ReportActions
              filename='guardians'
              title='Guardians'
              meta={`Generated ${new Date().toISOString().slice(0, 10)} · ${filtered.length} of ${(guardians ?? []).length} guardians`}
              header={['Guardian ID', 'Full Name', 'Relationship', 'Phone', 'Email', 'Portal Access']}
              rows={reportRows}
            />
            <Button variant='outline' onClick={() => setImportOpen(true)}>
              <Upload className='h-4 w-4' />
              Import
            </Button>
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetAddForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add guardian</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a guardian</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Full name' className='col-span-2'>
                  <Input className={compactControlClass} placeholder='Mrs. Jane Doe' value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
                </CompactField>
                <CompactField label='Relationship'>
                  <Select value={newRelationship} onValueChange={(v) => setNewRelationship(v as NewGuardianInput['relationship'])}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='Father'>Father</SelectItem>
                      <SelectItem value='Mother'>Mother</SelectItem>
                      <SelectItem value='Guardian'>Guardian</SelectItem>
                      <SelectItem value='Other'>Other</SelectItem>
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='ID number'>
                  <Input className={compactControlClass} placeholder='63-112233A45' value={newNationalId} onChange={(e) => setNewNationalId(e.target.value)} />
                </CompactField>
                <CompactField label='Phone'>
                  <Input className={compactControlClass} placeholder='+263 77 …' value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </CompactField>
                <CompactField label='Email'>
                  <Input className={compactControlClass} placeholder='name@example.com' value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={handleAddGuardian} disabled={createGuardian.isPending}>Add guardian</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <ImportDialog<NewGuardianInput>
          open={importOpen}
          onOpenChange={setImportOpen}
          title='Import guardians'
          description='Full Name is required -- everything else is optional.'
          templateFilename='guardians-import-template.xlsx'
          templateHeaders={['Full Name', 'Relationship', 'ID Number', 'Phone', 'Email']}
          templateSample={['Mrs. Jane Doe', 'Mother', '63-112233A45', '+263 77 123 4567', 'jane.doe@example.com']}
          parseRow={(row) => {
            if (!row['Full Name']) return { error: 'Missing Full Name' }
            return {
              value: {
                full_name: row['Full Name'],
                relationship: (row['Relationship'] || undefined) as NewGuardianInput['relationship'],
                national_id: row['ID Number'] || undefined,
                phone_number: row['Phone'] || undefined,
                email: row['Email'] || undefined,
              },
            }
          }}
          rowLabel={(r) => r.full_name}
          commitRow={async (r) => { await createGuardian.mutateAsync(r) }}
        />

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All guardians</CardTitle>
                <CardDescription>{filtered.length} of {(guardians ?? []).length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by name or phone…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            {error ? (
              <p className='py-6 text-center text-sm text-destructive'>Could not load guardians.</p>
            ) : (
              <DataList
                data={filtered}
                columns={columns}
                getRowId={(g) => g.name}
                onRowClick={(g) => setViewing(g)}
                densityStorageKey='guardians'
                isLoading={isLoading}
                emptyState={{
                  icon: UserSearch,
                  title: 'No guardians found',
                  description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Guardians will appear here once added.',
                  actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                  onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
                }}
              />
            )}
          </CardContent>
        </Card>

        {viewing && (
          <GuardianDetailDialog
            guardian={viewing}
            linkedStudents={linkedStudentsByGuardian.get(viewing.name) ?? []}
            onClose={() => setViewing(null)}
          />
        )}
      </Main>
    </>
  )
}
