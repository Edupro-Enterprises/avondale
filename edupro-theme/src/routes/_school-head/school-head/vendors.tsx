import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useVendors, useApproveVendor, useSuspendVendor, type FrappeVendor } from '@/lib/frappe/vendors'

export const Route = createFileRoute('/_school-head/school-head/vendors')({
  component: SchoolHeadVendorsPage,
})

const statusTone: Record<FrappeVendor['approval_status'], StatusTone> = {
  Pending: 'neutral',
  Approved: 'good',
  Suspended: 'bad',
}

const columns: DataListColumn<FrappeVendor>[] = [
  {
    id: 'name',
    header: 'Vendor',
    sortable: true,
    sortValue: (v) => v.vendor_name,
    className: 'min-w-48',
    cell: (v) => (
      <div className='flex flex-col'>
        <span className='truncate'>{v.vendor_name}</span>
        <span className='truncate text-xs text-muted-foreground'>{v.vendor_type}{v.contact_person ? ` · ${v.contact_person}` : ''}</span>
      </div>
    ),
  },
  { id: 'phone', header: 'Phone', sortable: true, sortValue: (v) => v.phone_number ?? '', cell: (v) => v.phone_number ?? '—' },
  { id: 'email', header: 'Email', sortable: true, sortValue: (v) => v.email ?? '', cell: (v) => v.email ?? '—' },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    sortValue: (v) => v.approval_status,
    cell: (v) => <StatusBadge tone={statusTone[v.approval_status]}>{v.approval_status}</StatusBadge>,
  },
]

function SchoolHeadVendorsPage() {
  const { data: vendors, isLoading, error } = useVendors()
  const approveVendor = useApproveVendor()
  const suspendVendor = useSuspendVendor()
  const [selected, setSelected] = useState<FrappeVendor | null>(null)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')

  async function approve() {
    if (!selected) return
    try {
      await approveVendor.mutateAsync(selected.name)
      toast.success(`${selected.vendor_name} approved`)
      setSelected(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not approve this vendor.')
    }
  }

  async function suspend() {
    if (!selected) return
    if (!suspendReason.trim()) {
      toast.error('A suspension reason is required.')
      return
    }
    try {
      await suspendVendor.mutateAsync({ vendor: selected.name, reason: suspendReason.trim() })
      toast.success(`${selected.vendor_name} suspended`)
      setSuspendOpen(false)
      setSuspendReason('')
      setSelected(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not suspend this vendor.')
    }
  }

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Vendors</h1>
          <p className='text-sm text-muted-foreground'>Only School Head can admit a vendor onto the approved list a Purchase Order can be issued against.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load vendors from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>All vendors</CardTitle>
            <CardDescription>{(vendors ?? []).length} vendors</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={vendors ?? []}
              columns={columns}
              getRowId={(v) => v.name}
              isLoading={isLoading}
              onRowClick={(v) => setSelected(v)}
              densityStorageKey='school-head-vendors'
              emptyState={{ icon: Building2, title: 'No vendors found', description: 'Vendors registered by the Bursar will appear here.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selected && !suspendOpen} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.vendor_name}</DialogTitle>
              <DialogDescription>{selected?.vendor_type}{selected?.contact_person ? ` · ${selected.contact_person}` : ''}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-2 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Phone</span><span>{selected.phone_number ?? '—'}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Email</span><span>{selected.email ?? '—'}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Status</span><StatusBadge tone={statusTone[selected.approval_status]}>{selected.approval_status}</StatusBadge></div>
                {selected.suspension_reason && (
                  <div className='flex justify-between'><span className='text-muted-foreground'>Suspension reason</span><span>{selected.suspension_reason}</span></div>
                )}
              </div>
            )}
            <DialogFooter>
              {selected?.approval_status !== 'Suspended' && (
                <Button variant='outline' onClick={() => setSuspendOpen(true)}>Suspend</Button>
              )}
              {selected?.approval_status !== 'Approved' && (
                <Button disabled={approveVendor.isPending} onClick={approve}>{approveVendor.isPending ? 'Approving…' : 'Approve'}</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={suspendOpen} onOpenChange={(o) => { setSuspendOpen(o); if (!o) setSuspendReason('') }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspend {selected?.vendor_name}?</DialogTitle>
              <DialogDescription>Blocks any new Purchase Order against them; past orders are untouched.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-2 py-2'>
              <Label htmlFor='suspend-reason'>Reason</Label>
              <Textarea id='suspend-reason' value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder='Why is this vendor being suspended?' />
            </div>
            <DialogFooter>
              <Button variant='destructive' disabled={suspendVendor.isPending} onClick={suspend}>{suspendVendor.isPending ? 'Suspending…' : 'Confirm suspend'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
