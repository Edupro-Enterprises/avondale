/** School Setup doctype access -- see the backend repo's
 * edupro_school_fees/doctype/school_setup/school_setup.json and .py.
 * Exactly one record ever exists (autoname by school_code,
 * validate_single_instance() rejects a second) -- this always fetches
 * that one record, never creates a new one from this shell. Saving
 * banking_configuration replaces the whole child table, same pattern as
 * Requisition quotations elsewhere in this app; the server enforces the
 * real constraints (at least one active Tuition and one active Levy/SDC
 * row, each needing both a ZiG and an FCA/USD variant). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeBankingConfigRow {
  name: string
  bank_name: string
  account_name: string
  account_number: string
  branch?: string
  swift_code?: string
  currency_type: 'ZiG' | 'FCA'
  fee_stream: 'Tuition' | 'Levy/SDC' | 'Boarding' | 'Project'
  is_active: 0 | 1
  account?: string
}

export interface FrappeProcurementQuoteBand {
  name: string
  min_amount: number
  required_quotes: number
}

export interface FrappeSchoolSetup {
  name: string
  school_name: string
  registration_number: string
  emis_number: string
  school_code: string
  school_logo?: string
  physical_address: string
  postal_address?: string
  telephone?: string
  email?: string
  contact_person?: string
  district?: string
  region?: string
  legal_entity_type?: 'Government' | 'Council' | 'Church' | 'Private Trust' | ''
  banking_configuration: FrappeBankingConfigRow[]
  fund_a_name?: string
  fund_b_name?: string
  cash_up_variance_threshold?: number
  sensitive_procurement_threshold?: number
  procurement_quote_bands: FrappeProcurementQuoteBand[]
  primary_color?: string
  secondary_color?: string
  receipt_header?: string
  receipt_footer?: string
  statement_header?: string
  statement_footer?: string
  first_reminder_days?: number
  second_reminder_days?: number
  escalation_days?: number
  first_reminder_template?: string
  second_reminder_template?: string
}

export interface SchoolBranding {
  school_name?: string
  school_logo?: string
}

/** School name + logo only, via a guest-accessible whitelisted method --
 * distinct from useSchoolSetup, which needs a real session with School
 * Setup's own DocPerm (System Manager/School Head/Bursar only, since that
 * doctype also holds banking details). This is what the sign-in page and
 * every role shell's sidebar/header actually need, and works before login. */
export function useSchoolBranding() {
  return useQuery({
    queryKey: ['school-branding'],
    queryFn: async () =>
      (
        await api.get<{ message: SchoolBranding }>(
          '/api/method/edupro_school_fees.edupro_school_fees.doctype.school_setup.school_setup.get_school_branding'
        )
      ).message,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSchoolSetup() {
  return useQuery({
    queryKey: ['school-setup'],
    queryFn: async () => {
      const list = await listResource<{ name: string }>('School Setup', { limit_page_length: '1' })
      if (list.data.length === 0) return null
      return (
        await api.get<{ data: FrappeSchoolSetup }>(`/api/resource/School Setup/${encodeURIComponent(list.data[0].name)}`)
      ).data
    },
  })
}

/** Child-table writes (banking_configuration/procurement_quote_bands) don't
 * need `name` -- Frappe assigns one to any row that omits it, same as every
 * other whole-table-replace write in this app (Requisition quotations,
 * Payment Plan installments, Bank Reconciliation adjustments). */
export interface SchoolSetupUpdateInput extends Partial<Omit<FrappeSchoolSetup, 'name' | 'banking_configuration' | 'procurement_quote_bands'>> {
  banking_configuration?: Array<Omit<FrappeBankingConfigRow, 'name'>>
  procurement_quote_bands?: Array<Omit<FrappeProcurementQuoteBand, 'name'>>
}

export interface DocumentLetterhead {
  schoolName: string
  registrationNumber?: string
  emisNumber?: string
  logoUrl?: string
  address?: string
  telephone?: string
  email?: string
}

/** The one source of School Setup's own identity fields every generated
 * document (receipt, statement, report PDF) should share -- so "sync the
 * institution profile everywhere" means editing it once here, not touching
 * every document builder that reads it. Document-type-specific text
 * (receipt_header vs statement_header, etc.) stays out of this -- callers
 * add their own headerNote/footerNote on top of this shared base. */
export function useDocumentLetterhead(): DocumentLetterhead {
  const { data } = useSchoolSetup()
  return {
    schoolName: data?.school_name ?? 'Edupro School',
    registrationNumber: data?.registration_number,
    emisNumber: data?.emis_number,
    logoUrl: data?.school_logo,
    address: data?.physical_address,
    telephone: data?.telephone,
    email: data?.email,
  }
}

/** Maps a ledger Account name to its real-world bank label (e.g. "NMB
 * (FCA)") via School Setup's own banking_configuration rows -- the Account
 * doctype only knows its own internal name/currency, not which physical
 * bank it represents. */
export function useBankNameByAccount(): Map<string, string> {
  const { data } = useSchoolSetup()
  const map = new Map<string, string>()
  for (const row of data?.banking_configuration ?? []) {
    if (row.account) map.set(row.account, `${row.bank_name} (${row.currency_type})`)
  }
  return map
}

export function useUpdateSchoolSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, input }: { name: string; input: SchoolSetupUpdateInput }) => {
      await api.put(`/api/resource/School Setup/${encodeURIComponent(name)}`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-setup'] })
      queryClient.invalidateQueries({ queryKey: ['school-branding'] })
    },
  })
}
