/** Boarding House / Dormitory Room doctype access -- see the backend
 * repo's edupro_school_fees/doctype/boarding_house/boarding_house.json
 * and .../dormitory_room/dormitory_room.json. Both newly added; kept as
 * standalone reference entities -- Student.hostel_room stays the free-text
 * field it already is. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeBoardingHouse {
  name: string
  house_parent_name?: string
  capacity?: number
}

export function useBoardingHouses() {
  return useQuery({
    queryKey: ['boarding-houses'],
    queryFn: async () => {
      const res = await listResource<FrappeBoardingHouse>('Boarding House', {
        fields: JSON.stringify(['name', 'house_parent_name', 'capacity']),
        order_by: 'name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useCreateBoardingHouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { house_name: string; house_parent_name?: string; capacity?: number }) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Boarding House', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boarding-houses'] }),
  })
}

export interface FrappeDormitoryRoom {
  name: string
  room_number: string
  boarding_house: string
  capacity?: number
}

export function useDormitoryRooms() {
  return useQuery({
    queryKey: ['dormitory-rooms'],
    queryFn: async () => {
      const res = await listResource<FrappeDormitoryRoom>('Dormitory Room', {
        fields: JSON.stringify(['name', 'room_number', 'boarding_house', 'capacity']),
        order_by: 'room_number asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewDormitoryRoomInput {
  room_number: string
  boarding_house: string
  capacity?: number
}

export function useCreateDormitoryRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewDormitoryRoomInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Dormitory Room', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dormitory-rooms'] }),
  })
}
