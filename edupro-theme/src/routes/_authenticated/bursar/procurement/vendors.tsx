import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useVendors, useCreateVendor, type FrappeVendor } from '@/lib/frappe/vendors'

export const Route = createFileRoute('/_authenticated/bursar/procurement/vendors')({
  component: VendorsPage,
})

const statusTone: Record<FrappeVendor['approval_status'], StatusTone> = {
  Pending: 'neutral',
  Approved: 'good',
  Suspended: 'bad',
}

const VENDOR_TYPES: FrappeVendor['vendor_type'][] = ['Sole Trader', 'Company', 'Cooperative', 'Other']

function VendorsPage() {
  const { data: vendors, isLoading, error } = useVendors()
  const createVendor = useCreateVendor()
  const [open, setOpen] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [vendorType, setVendorType] = useState<FrappeVendor['vendor_type']>('Company')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  function resetForm() {
    setVendorName('')
    setVendorType('Company')
    setContactPerson('')
    setPhone('')
    setEmail('')
  }

  async function submit() {
    if (!vendorName.trim()) {
      toast.error('Vendor name is required.')
      return
    }
    try {
      await createVendor.mutateAsync({
        vendor_name: vendorName.trim(),
        vendor_type: vendorType,
        contact_person: contactPerson || undefined,
        phone_number: phone || undefined,
        email: email || undefined,
      })
      toast.success(`${vendorName.trim()} added, awaiting School Head approval`)
      setOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this vendor.')
    }
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

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Procurement</p>
            <h1 className='text-3xl font-bold tracking-tight'>Vendors</h1>
            <p className='text-sm text-muted-foreground'>New vendors need School Head approval before a Purchase Order can be issued to them.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add vendor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a vendor</DialogTitle>
                <DialogDescription>Starts Pending until a School Head approves it.</DialogDescription>
              </DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='vendor-name'>Vendor name</Label>
                  <Input id='vendor-name' value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder='Ridgeway Hardware' />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='vendor-type'>Type</Label>
                  <Select value={vendorType} onValueChange={(v) => setVendorType(v as FrappeVendor['vendor_type'])}>
                    <SelectTrigger id='vendor-type'><SelectValue /></SelectTrigger>
                    <SelectContent>{VENDOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='contact-person'>Contact person (optional)</Label>
                  <Input id='contact-person' value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='phone'>Phone (optional)</Label>
                    <Input id='phone' value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='email'>Email (optional)</Label>
                    <Input id='email' type='email' value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createVendor.isPending}>{createVendor.isPending ? 'Adding…' : 'Add vendor'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              densityStorageKey='vendors'
              emptyState={{ icon: Building2, title: 'No vendors found', description: 'Vendors will appear here once added.' }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
