import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Bus, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useBusRoutes, useBusRoute, useCreateBusRoute, type FrappeBusRoute, type NewBusRouteStopInput } from '@/lib/frappe/bus-routes'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/bus-routes')({
  component: BusRoutesPage,
})

const emptyStop: NewBusRouteStopInput = { stop_name: '', pickup_time: '' }

function BusRoutesPage() {
  const { data: busRoutes, isLoading, error } = useBusRoutes()
  const createBusRoute = useCreateBusRoute()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleReg, setVehicleReg] = useState('')
  const [stops, setStops] = useState<NewBusRouteStopInput[]>([{ ...emptyStop }])
  const [viewingName, setViewingName] = useState<string | null>(null)
  const { data: viewing } = useBusRoute(viewingName ?? undefined)

  const rows = useMemo(() => busRoutes ?? [], [busRoutes])
  const filtered = useMemo(() => rows.filter((br) => br.name.toLowerCase().includes(search.toLowerCase())), [rows, search])

  const columns: DataListColumn<FrappeBusRoute>[] = [
    {
      id: 'name',
      header: 'Route',
      sortable: true,
      sortValue: (br) => br.name,
      className: 'min-w-48',
      cell: (br) => (
        <div className='flex flex-col'>
          <span className='truncate'>{br.name}</span>
          <span className='truncate text-xs text-muted-foreground'>{br.driver_name ?? 'No driver set'}{br.vehicle_registration ? ` · ${br.vehicle_registration}` : ''}</span>
        </div>
      ),
    },
  ]

  function updateStop(index: number, patch: Partial<NewBusRouteStopInput>) {
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function resetForm() {
    setRouteName('')
    setDriverName('')
    setVehicleReg('')
    setStops([{ ...emptyStop }])
  }

  async function submit() {
    const cleanStops = stops.filter((s) => s.stop_name.trim())
    if (!routeName.trim()) {
      toast.error('Route name is required.')
      return
    }
    try {
      await createBusRoute.mutateAsync({
        route_name: routeName.trim(),
        driver_name: driverName || undefined,
        vehicle_registration: vehicleReg || undefined,
        stops: cleanStops,
      })
      toast.success('Bus route added')
      setAddOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this bus route.')
    }
  }

  const isDirty = routeName !== '' || driverName !== '' || vehicleReg !== '' || stops.some((s) => s.stop_name !== '' || s.pickup_time)
  const guard = useUnsavedChangesGuard(isDirty, () => { setAddOpen(false); resetForm() })

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup · Boarding & Transport</p>
            <h1 className='text-3xl font-bold tracking-tight'>Bus Routes</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => (o ? setAddOpen(true) : guard.handleOpenChange(o))}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add route</Button>
            </DialogTrigger>
            <DialogContent size='md'>
              <DialogHeader><DialogTitle>Add a bus route</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Route name' className='col-span-2'>
                  <Input className={compactControlClass} value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder='Mbare — Glen View' />
                </CompactField>
                <CompactField label='Driver name'>
                  <Input className={compactControlClass} value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder='Name' />
                </CompactField>
                <CompactField label='Vehicle registration'>
                  <Input className={compactControlClass} value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} placeholder='AFB 4471' />
                </CompactField>

                <div className='col-span-2 mt-2'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground'>Stops</p>
                    <Button type='button' variant='outline' size='sm' onClick={() => setStops((prev) => [...prev, { ...emptyStop }])}>
                      <Plus className='h-3.5 w-3.5' />Add stop
                    </Button>
                  </div>
                  <div className='grid gap-2'>
                    {stops.map((stop, i) => (
                      <div key={i} className='grid grid-cols-[2fr_1fr_auto] items-end gap-2'>
                        <CompactField label='Stop name'>
                          <Input className={compactControlClass} value={stop.stop_name} onChange={(e) => updateStop(i, { stop_name: e.target.value })} />
                        </CompactField>
                        <CompactField label='Pickup'>
                          <Input type='time' className={compactControlClass} value={stop.pickup_time ?? ''} onChange={(e) => updateStop(i, { pickup_time: e.target.value })} />
                        </CompactField>
                        <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))} disabled={stops.length === 1} aria-label='Remove this stop'>
                          <X className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createBusRoute.isPending}>{createBusRoute.isPending ? 'Adding…' : 'Add route'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog {...guard.discardDialogProps} />
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load bus routes from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <CardTitle>All bus routes</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <div className='relative'>
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input placeholder='Search…' className='pl-8' value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(br) => br.name}
              isLoading={isLoading}
              onRowClick={(br) => setViewingName(br.name)}
              densityStorageKey='bus-routes'
              emptyState={{
                icon: Bus,
                title: 'No bus routes found',
                description: search ? 'Try a different search.' : 'Bus routes will appear here once added.',
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!viewingName} onOpenChange={(o) => !o && setViewingName(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{viewing?.name}</DialogTitle></DialogHeader>
            {viewing && (
              <div className='space-y-3 text-sm'>
                <div className='flex justify-between'><span className='text-muted-foreground'>Driver</span><span>{viewing.driver_name ?? '—'}</span></div>
                <div className='flex justify-between'><span className='text-muted-foreground'>Vehicle</span><span>{viewing.vehicle_registration ?? '—'}</span></div>
                <div>
                  <p className='mb-1 text-xs font-medium text-muted-foreground'>Stops</p>
                  <div className='divide-y rounded-md border'>
                    {viewing.stops.length === 0 && <p className='px-3 py-3 text-sm text-muted-foreground'>No stops recorded.</p>}
                    {viewing.stops.map((s) => (
                      <div key={s.name} className='flex items-center justify-between px-3 py-2'>
                        <span>{s.stop_name}</span>
                        <span className='text-muted-foreground'>{s.pickup_time ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
