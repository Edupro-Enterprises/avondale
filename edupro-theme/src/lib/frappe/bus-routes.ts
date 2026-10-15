/** Bus Route doctype access -- see the backend repo's
 * edupro_school_fees/doctype/bus_route/bus_route.json and
 * .../bus_route_stop/bus_route_stop.json. Newly added; kept standalone --
 * Student.bus_route stays free text and there's no per-route fee field
 * (transport charges, if any, are a Fee Item on the real fee structure,
 * not a property of the route itself). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeBusRoute {
  name: string
  driver_name?: string
  vehicle_registration?: string
}

export function useBusRoutes() {
  return useQuery({
    queryKey: ['bus-routes'],
    queryFn: async () => {
      const res = await listResource<FrappeBusRoute>('Bus Route', {
        fields: JSON.stringify(['name', 'driver_name', 'vehicle_registration']),
        order_by: 'name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeBusRouteStop {
  name: string
  stop_name: string
  pickup_time?: string
}

export interface FrappeBusRouteDetail extends FrappeBusRoute {
  stops: FrappeBusRouteStop[]
}

export function useBusRoute(name: string | undefined) {
  return useQuery({
    queryKey: ['bus-route', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeBusRouteDetail }>(`/api/resource/Bus Route/${encodeURIComponent(name!)}`)
      ).data,
    enabled: !!name,
  })
}

export interface NewBusRouteStopInput {
  stop_name: string
  pickup_time?: string
}

export interface NewBusRouteInput {
  route_name: string
  driver_name?: string
  vehicle_registration?: string
  stops: NewBusRouteStopInput[]
}

export function useCreateBusRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBusRouteInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Bus Route', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bus-routes'] }),
  })
}
