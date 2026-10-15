/** Vendor doctype access -- see the backend repo's
 * edupro_school_fees/doctype/vendor/vendor.json and vendor.py. approve_vendor
 * / suspend_vendor (useApproveVendor/useSuspendVendor below) are
 * School-Head-only (server throws PermissionError for anyone else) -- a
 * Bursar can register a vendor but only School Head admits it onto the
 * approved list a Purchase Order can be issued against. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

const VENDOR_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.vendor.vendor'

export interface FrappeVendor {
  name: string
  vendor_name: string
  vendor_type: 'Sole Trader' | 'Company' | 'Cooperative' | 'Other'
  contact_person?: string
  phone_number?: string
  email?: string
  approval_status: 'Pending' | 'Approved' | 'Suspended'
  approved_by?: string
  approved_on?: string
  suspension_reason?: string
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await listResource<FrappeVendor>('Vendor', {
        fields: JSON.stringify([
          'name', 'vendor_name', 'vendor_type', 'contact_person', 'phone_number', 'email',
          'approval_status', 'approved_by', 'approved_on', 'suspension_reason',
        ]),
        order_by: 'vendor_name asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewVendorInput {
  vendor_name: string
  vendor_type?: FrappeVendor['vendor_type']
  contact_person?: string
  phone_number?: string
  email?: string
}

export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewVendorInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Vendor', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useApproveVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vendor: string) => {
      await api.post(`/api/method/${VENDOR_MODULE}.approve_vendor`, { vendor })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useSuspendVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ vendor, reason }: { vendor: string; reason: string }) => {
      await api.post(`/api/method/${VENDOR_MODULE}.suspend_vendor`, { vendor, reason })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  })
}
