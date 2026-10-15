import type { Fund } from './budget-vote-lines'

export interface JournalEntry {
  id: string
  date: string
  reference: string
  fund: Fund
  chartOfAccountId: string
  costCenterId: string
  debitUSD: number
  creditUSD: number
  description: string
}

export const mockJournalEntries: JournalEntry[] = [
  {
    id: 'JE-2026-00171',
    date: '2026-01-08',
    reference: 'INV-2026-00147',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-4000',
    costCenterId: 'CC-01',
    debitUSD: 375,
    creditUSD: 375,
    description: 'Invoice raised — Tadiwa Moyo Jr., Term 1',
  },
  {
    id: 'JE-2026-00179',
    date: '2026-02-10',
    reference: 'RCT-2026-00089',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-1000',
    costCenterId: 'CC-01',
    debitUSD: 175,
    creditUSD: 175,
    description: 'Receipt posted — Tadiwa Moyo Jr.',
  },
  {
    id: 'JE-2026-00180',
    date: '2026-01-22',
    reference: 'PO-2026-001',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-5000',
    costCenterId: 'CC-01',
    debitUSD: 320,
    creditUSD: 320,
    description: 'Payment voucher disbursed — Harare Stationers',
  },
  {
    id: 'JE-2026-00181',
    date: '2026-01-12',
    reference: 'RCT-2026-00090',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-1000',
    costCenterId: 'CC-01',
    debitUSD: 375,
    creditUSD: 375,
    description: 'Receipt posted — Rutendo Chikafu',
  },
]
