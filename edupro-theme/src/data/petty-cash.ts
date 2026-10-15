export type PettyCashTransactionType = 'Top-up' | 'Expense'

export interface PettyCashTransaction {
  id: string
  date: string
  description: string
  type: PettyCashTransactionType
  amountUSD: number
  costCenterId: string
  balanceAfterUSD: number
  recordedBy: string
}

export const mockPettyCashTransactions: PettyCashTransaction[] = [
  {
    id: 'PC-2026-001',
    date: '2026-01-05',
    description: 'Float top-up from Cash Office',
    type: 'Top-up',
    amountUSD: 200,
    costCenterId: 'CC-01',
    balanceAfterUSD: 200,
    recordedBy: 'Tendai Marufu',
  },
  {
    id: 'PC-2026-002',
    date: '2026-01-14',
    description: 'Courier fees — exam paper collection',
    type: 'Expense',
    amountUSD: 15,
    costCenterId: 'CC-02',
    balanceAfterUSD: 185,
    recordedBy: 'Tendai Marufu',
  },
  {
    id: 'PC-2026-003',
    date: '2026-01-29',
    description: 'Tea and refreshments — SDC meeting',
    type: 'Expense',
    amountUSD: 22,
    costCenterId: 'CC-01',
    balanceAfterUSD: 163,
    recordedBy: 'Tendai Marufu',
  },
  {
    id: 'PC-2026-004',
    date: '2026-02-10',
    description: 'Plumbing call-out — boarding house tap',
    type: 'Expense',
    amountUSD: 40,
    costCenterId: 'CC-03',
    balanceAfterUSD: 123,
    recordedBy: 'Tendai Marufu',
  },
  {
    id: 'PC-2026-005',
    date: '2026-02-12',
    description: 'Float top-up from Cash Office',
    type: 'Top-up',
    amountUSD: 100,
    costCenterId: 'CC-01',
    balanceAfterUSD: 223,
    recordedBy: 'Tendai Marufu',
  },
]
