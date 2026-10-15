/** Journal Entry doctype access -- see the backend repo's
 * edupro_school_fees/doctype/journal_entry/journal_entry.json. Read-only GL
 * feed: entries post automatically from Receipts, Payment Vouchers, etc. --
 * nothing here creates a Journal Entry directly. */
import { useQuery } from '@tanstack/react-query'
import { api, listResource } from './client'

export type Fund = 'Fund A - General/Government' | 'Fund B - SDC/SDA'

export interface FrappeJournalEntry {
  name: string
  posting_date: string
  reference_doctype?: string
  reference_name?: string
  /** Null on entries posted before fund-tagging existed on this doctype --
   * real data on production has ~70 such entries. Treat as Fund A, the
   * documented default for fee-side (Invoice/Receipt) entries. */
  fund: Fund | null
  total_debit: number
  total_credit: number
  remarks?: string
}

export interface FrappeJournalEntryLine {
  name: string
  account: string
  debit: number
  credit: number
  exchange_rate: number
}

export interface FrappeJournalEntryDetail extends FrappeJournalEntry {
  entries: FrappeJournalEntryLine[]
  reversal_of?: string
  reversal_reason?: string
  reversed_by?: string
  owner: string
}

const JE_FIELDS = [
  'name',
  'posting_date',
  'reference_doctype',
  'reference_name',
  'fund',
  'total_debit',
  'total_credit',
  'remarks',
]

export function useJournalEntries() {
  return useQuery({
    queryKey: ['journal-entries'],
    queryFn: async () => {
      const res = await listResource<FrappeJournalEntry>('Journal Entry', {
        fields: JSON.stringify(JE_FIELDS),
        filters: JSON.stringify([['docstatus', '=', 1]]),
        order_by: 'posting_date desc, modified desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useJournalEntry(name: string | undefined) {
  return useQuery({
    queryKey: ['journal-entry', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeJournalEntryDetail }>(
          `/api/resource/Journal Entry/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}
