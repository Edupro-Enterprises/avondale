/** District/Region reference data -- read-only pickers for School Setup's
 * Location section. See the backend repo's edupro_school_fees/doctype/
 * district and .../region. No create UI -- these are seeded reference
 * geography, not something a Bursar adds to. */
import { useQuery } from '@tanstack/react-query'
import { listResource } from './client'

export interface FrappeDistrict {
  name: string
  district_name: string
}

export function useDistricts() {
  return useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await listResource<FrappeDistrict>('District', {
        fields: JSON.stringify(['name', 'district_name']),
        order_by: 'district_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface FrappeRegion {
  name: string
  region_name: string
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const res = await listResource<FrappeRegion>('Region', {
        fields: JSON.stringify(['name', 'region_name']),
        order_by: 'region_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}
