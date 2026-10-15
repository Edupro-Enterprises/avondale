import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BedDouble, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useBoardingHouses, useDormitoryRooms, useCreateDormitoryRoom, type FrappeDormitoryRoom } from '@/lib/frappe/boarding'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/dormitory-rooms')({
  component: DormitoryRoomsPage,
})

function DormitoryRoomsPage() {
  const { data: rooms, isLoading, error } = useDormitoryRooms()
  const { data: houses } = useBoardingHouses()
  const createRoom = useCreateDormitoryRoom()

  const [addOpen, setAddOpen] = useState(false)
  const [boardingHouse, setBoardingHouse] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [capacity, setCapacity] = useState('')

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [{ key: 'house', label: 'Boarding House', options: (houses ?? []).map((h) => h.name) }],
    [houses]
  )
  const filters = useFilters('dormitory-rooms', filterGroups)

  const rows = useMemo(() => rooms ?? [], [rooms])
  const filtered = useMemo(
    () =>
      rows.filter(
        (dr) => dr.room_number.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.house || dr.boarding_house === filters.values.house)
      ),
    [rows, filters.search, filters.values]
  )

  async function submit() {
    if (!boardingHouse || !roomNumber.trim()) {
      toast.error('Boarding house and room number are required.')
      return
    }
    try {
      await createRoom.mutateAsync({ boarding_house: boardingHouse, room_number: roomNumber.trim(), capacity: capacity ? Number(capacity) : undefined })
      toast.success('Dormitory room added')
      setAddOpen(false)
      setBoardingHouse('')
      setRoomNumber('')
      setCapacity('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this room.')
    }
  }

  const columns: DataListColumn<FrappeDormitoryRoom>[] = [
    {
      id: 'room',
      header: 'Room',
      sortable: true,
      sortValue: (dr) => dr.room_number,
      cell: (dr) => (
        <div className='flex flex-col'>
          <span className='truncate'>{dr.room_number}</span>
          <span className='truncate text-xs text-muted-foreground'>{dr.boarding_house}{dr.capacity ? ` · capacity ${dr.capacity}` : ''}</span>
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
            <h1 className='text-3xl font-bold tracking-tight'>Dormitory Rooms</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button disabled={!houses?.length}><Plus className='h-4 w-4' />Add room</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a dormitory room</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Boarding house' className='col-span-2'>
                  <Select value={boardingHouse} onValueChange={setBoardingHouse}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{(houses ?? []).map((h) => <SelectItem key={h.name} value={h.name}>{h.name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Room number'>
                  <Input className={compactControlClass} value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder='103' />
                </CompactField>
                <CompactField label='Capacity'>
                  <Input type='number' className={compactControlClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder='6' />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createRoom.isPending}>{createRoom.isPending ? 'Adding…' : 'Add room'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load dormitory rooms from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All dormitory rooms</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search by room number…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(dr) => dr.name}
              isLoading={isLoading}
              densityStorageKey='dormitory-rooms'
              emptyState={{
                icon: BedDouble,
                title: 'No dormitory rooms found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Rooms will appear here once added.',
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
