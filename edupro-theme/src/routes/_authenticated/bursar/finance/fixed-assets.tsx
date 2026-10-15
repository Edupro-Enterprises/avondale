import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Archive, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAccounts } from '@/lib/frappe/accounts'
import { useFixedAssets, useCreateFixedAsset, useDisposeAsset, type FrappeAsset, type NewAssetInput } from '@/lib/frappe/fixed-assets'

export const Route = createFileRoute('/_authenticated/bursar/finance/fixed-assets')({
  component: FixedAssetsPage,
})

const statusTone: Record<FrappeAsset['disposal_status'], StatusTone> = { 'In Use': 'good', Disposed: 'neutral' }

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'status', label: 'Status', options: ['In Use', 'Disposed'] }]

const defaultNewAsset: NewAssetInput = {
  asset_code: '',
  description: '',
  date_acquired: '',
  historical_cost: 0,
  currency: 'ZiG',
  depreciation_rate: 10,
  depreciation_expense_account: '',
  accumulated_depreciation_account: '',
  physical_location: '',
}

function FixedAssetsPage() {
  const { data: assets, isLoading, error } = useFixedAssets()
  const { data: accounts } = useAccounts()
  const createAsset = useCreateFixedAsset()
  const disposeAsset = useDisposeAsset()
  const filters = useFilters('fixed-assets', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<NewAssetInput>(defaultNewAsset)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [disposeOpen, setDisposeOpen] = useState(false)
  const [disposalDate, setDisposalDate] = useState('')
  const [disposalPraz, setDisposalPraz] = useState('')

  const rows = useMemo(() => assets ?? [], [assets])
  const selected = rows.find((a) => a.name === selectedName) ?? null
  const filtered = useMemo(
    () => rows.filter((a) => a.description.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.status || a.disposal_status === filters.values.status)),
    [rows, filters.search, filters.values]
  )
  const totalBookValueUSD = useMemo(() => rows.filter((a) => a.currency === 'USD').reduce((sum, a) => sum + a.net_book_value, 0), [rows])

  function update(patch: Partial<NewAssetInput>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  async function submit() {
    if (!form.asset_code.trim() || !form.description.trim() || !form.date_acquired || !form.historical_cost || !form.depreciation_expense_account || !form.accumulated_depreciation_account) {
      toast.error('Asset code, description, date acquired, cost and both depreciation accounts are all required.')
      return
    }
    try {
      await createAsset.mutateAsync(form)
      toast.success('Asset added to the register')
      setAddOpen(false)
      setForm(defaultNewAsset)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this asset.')
    }
  }

  async function submitDispose() {
    if (!selected || !disposalDate) {
      toast.error('Disposal date is required.')
      return
    }
    try {
      await disposeAsset.mutateAsync({ name: selected.name, disposalDate, prazReference: disposalPraz || undefined })
      toast.success(`${selected.name} marked Disposed`)
      setDisposeOpen(false)
      setDisposalDate('')
      setDisposalPraz('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not dispose this asset.')
    }
  }

  const columns: DataListColumn<FrappeAsset>[] = [
    {
      id: 'name',
      header: 'Asset',
      sortable: true,
      sortValue: (a) => a.description,
      className: 'min-w-48',
      cell: (a) => (
        <div className='flex flex-col'>
          <span className='truncate'>{a.description}</span>
          <span className='truncate text-xs text-muted-foreground'>{a.asset_code}{a.physical_location ? ` · ${a.physical_location}` : ''}</span>
        </div>
      ),
    },
    {
      id: 'bookValue',
      header: 'Net Book Value',
      sortable: true,
      sortValue: (a) => a.net_book_value,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (a) => (a.currency === 'ZiG' ? <span>{a.net_book_value.toFixed(2)} ZiG</span> : <Money usd={a.net_book_value} />),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (a) => a.disposal_status,
      cell: (a) => <StatusBadge tone={statusTone[a.disposal_status]}>{a.disposal_status}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Finance</p>
            <h1 className='text-3xl font-bold tracking-tight'>Fixed Assets</h1>
            <p className='text-sm text-muted-foreground'>Depreciation posts automatically overnight -- net book value shown here is always the latest posted figure.</p>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (o) setForm(defaultNewAsset) }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add asset</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a fixed asset</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Asset code'>
                  <Input className={compactControlClass} value={form.asset_code} onChange={(e) => update({ asset_code: e.target.value })} placeholder='FA-2026-001' />
                </CompactField>
                <CompactField label='Description'>
                  <Input className={compactControlClass} value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder='Interactive whiteboard' />
                </CompactField>
                <CompactField label='Date acquired'>
                  <Input type='date' className={compactControlClass} value={form.date_acquired} onChange={(e) => update({ date_acquired: e.target.value })} />
                </CompactField>
                <CompactField label='Cost'>
                  <Input type='number' min='0' step='0.01' className={compactControlClass} value={form.historical_cost || ''} onChange={(e) => update({ historical_cost: Number(e.target.value) || 0 })} />
                </CompactField>
                <CompactField label='Currency'>
                  <Select value={form.currency} onValueChange={(v) => update({ currency: v as NewAssetInput['currency'] })}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value='ZiG'>ZiG</SelectItem><SelectItem value='USD'>USD</SelectItem></SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Depreciation rate (%/yr)'>
                  <Input type='number' min='0' max='100' className={compactControlClass} value={form.depreciation_rate || ''} onChange={(e) => update({ depreciation_rate: Number(e.target.value) || 0 })} />
                </CompactField>
                <CompactField label='Depreciation expense account' className='col-span-2'>
                  <Select value={form.depreciation_expense_account} onValueChange={(v) => update({ depreciation_expense_account: v })}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{(accounts ?? []).filter((a) => a.account_type === 'Expense').map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Accumulated depreciation account' className='col-span-2'>
                  <Select value={form.accumulated_depreciation_account} onValueChange={(v) => update({ accumulated_depreciation_account: v })}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{(accounts ?? []).filter((a) => a.account_type === 'Asset').map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Location' className='col-span-2'>
                  <Input className={compactControlClass} value={form.physical_location} onChange={(e) => update({ physical_location: e.target.value })} />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createAsset.isPending}>{createAsset.isPending ? 'Adding…' : 'Add asset'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load fixed assets from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card className='mb-4'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total net book value (USD-denominated assets)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'><Money usd={totalBookValueUSD} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Asset register</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(a) => a.name}
              isLoading={isLoading}
              onRowClick={(a) => setSelectedName(a.name)}
              densityStorageKey='fixed-assets'
              emptyState={{
                icon: Archive,
                title: 'No assets found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Assets will appear here once added to the register.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.description}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='grid grid-cols-2 gap-x-4 gap-y-2'>
                  <div><p className='text-xs text-muted-foreground'>Asset code</p><p>{selected.asset_code}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Condition</p><p>{selected.condition}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Location</p><p>{selected.physical_location ?? '—'}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Acquired</p><p>{selected.date_acquired}</p></div>
                  <div><p className='text-xs text-muted-foreground'>Depreciation</p><p>{selected.depreciation_method} · {selected.depreciation_rate}%/yr</p></div>
                  <div><p className='text-xs text-muted-foreground'>PRAZ reference</p><p>{selected.praz_reference ?? '—'}</p></div>
                </div>

                <div className='flex items-center justify-between border-t pt-3'>
                  <span className='font-medium'>Historical cost</span>
                  {selected.currency === 'ZiG' ? <span>{selected.historical_cost.toFixed(2)} ZiG</span> : <Money usd={selected.historical_cost} />}
                </div>
                <div className='flex items-center justify-between'>
                  <span className='font-medium'>Accumulated depreciation</span>
                  {selected.currency === 'ZiG' ? <span>{selected.accumulated_depreciation.toFixed(2)} ZiG</span> : <Money usd={selected.accumulated_depreciation} />}
                </div>
                <div className='flex items-center justify-between'>
                  <span className='font-medium'>Net book value</span>
                  {selected.currency === 'ZiG' ? <span>{selected.net_book_value.toFixed(2)} ZiG</span> : <Money usd={selected.net_book_value} />}
                </div>

                {selected.disposal_status === 'Disposed' && (
                  <div className='rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
                    Disposed {selected.disposal_date}{selected.disposal_praz_reference ? ` · PRAZ ${selected.disposal_praz_reference}` : ''}
                  </div>
                )}
              </div>
            )}
            {selected && selected.disposal_status === 'In Use' && (
              <DialogFooter>
                <Button variant='outline' onClick={() => setDisposeOpen(true)}>Mark disposed</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Dispose {selected?.description}</DialogTitle></DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium' htmlFor='disposal-date'>Disposal date</label>
                <Input id='disposal-date' type='date' value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium' htmlFor='disposal-praz'>Disposal PRAZ reference (optional)</label>
                <Input id='disposal-praz' value={disposalPraz} onChange={(e) => setDisposalPraz(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant='destructive' onClick={submitDispose} disabled={disposeAsset.isPending}>{disposeAsset.isPending ? 'Saving…' : 'Mark disposed'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
