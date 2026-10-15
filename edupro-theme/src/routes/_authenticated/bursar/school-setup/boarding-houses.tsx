import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useBoardingHouses, useCreateBoardingHouse, type FrappeBoardingHouse } from '@/lib/frappe/boarding'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/boarding-houses')({
  component: BoardingHousesPage,
})

const FILTER_GROUPS: FilterGroupDef[] = []

function BoardingHousesPage() {
  const { data: houses, isLoading, error } = useBoardingHouses()
  const createHouse = useCreateBoardingHouse()
  const filters = useFilters('boarding-houses', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [houseName, setHouseName] = useState('')
  const [houseParent, setHouseParent] = useState('')
  const [capacity, setCapacity] = useState('')

  const rows = useMemo(() => houses ?? [], [houses])
  const filtered = useMemo(
    () => rows.filter((bh) => bh.name.toLowerCase().includes(filters.search.toLowerCase())),
    [rows, filters.search]
  )

  async function submit() {
    if (!houseName.trim()) {
      toast.error('Name is required.')
      return
    }
    try {
      await createHouse.mutateAsync({ house_name: houseName.trim(), house_parent_name: houseParent || undefined, capacity: capacity ? Number(capacity) : undefined })
      toast.success('Boarding house added')
      setAddOpen(false)
      setHouseName('')
      setHouseParent('')
      setCapacity('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this boarding house.')
    }
  }

  const columns: DataListColumn<FrappeBoardingHouse>[] = [
    {
      id: 'name',
      header: 'House',
      sortable: true,
      sortValue: (bh) => bh.name,
      className: 'min-w-40',
      cell: (bh) => (
        <div className='flex flex-col'>
          <span className='truncate'>{bh.name}</span>
          <span className='truncate text-xs text-muted-foreground'>{bh.house_parent_name ?? 'No house parent set'}{bh.capacity ? ` · capacity ${bh.capacity}` : ''}</span>
        </div>
      ),
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup · Boarding & Transport</p>
            <h1 className='text-3xl font-bold tracking-tight'>Boarding Houses</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add house</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a boarding house</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Name' className='col-span-2'>
                  <Input className={compactControlClass} value={houseName} onChange={(e) => setHouseName(e.target.value)} placeholder='Nehanda House' />
                </CompactField>
                <CompactField label='House parent / warden'>
                  <Input className={compactControlClass} value={houseParent} onChange={(e) => setHouseParent(e.target.value)} placeholder='Name' />
                </CompactField>
                <CompactField label='Capacity'>
                  <Input type='number' className={compactControlClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder='120' />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createHouse.isPending}>{createHouse.isPending ? 'Adding…' : 'Add house'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load boarding houses from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All boarding houses</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(bh) => bh.name}
              isLoading={isLoading}
              densityStorageKey='boarding-houses'
              emptyState={{
                icon: Building2,
                title: 'No boarding houses found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Boarding houses will appear here once added.',
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
