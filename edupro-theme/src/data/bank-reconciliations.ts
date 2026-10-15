export type ReconciliationStatus = 'Draft' | 'Reviewed' | 'Approved'

export interface DepositInTransit {
  id: string
  description: string
  amountUSD: number
  date: string
}

export interface UnpresentedCheque {
  id: string
  payee: string
  chequeNumber: string
  amountUSD: number
  date: string
}

export interface BankReconciliation {
  id: string
  bankAccountId: string
  statementDate: string
  statementBalanceUSD: number
  bookBalanceUSD: number
  depositsInTransit: DepositInTransit[]
  unpresentedCheques: UnpresentedCheque[]
  preparedBy: string
  reviewedBy: string
  status: ReconciliationStatus
}

export const mockBankReconciliations: BankReconciliation[] = [
  {
    id: 'BREC-2026-01',
    bankAccountId: 'ACC-001',
    statementDate: '2026-01-31',
    statementBalanceUSD: 4675,
    bookBalanceUSD: 4550,
    depositsInTransit: [
      { id: 'DIT-1', description: 'EcoCash settlement — 30 Jan batch', amountUSD: 225, date: '2026-01-30' },
    ],
    unpresentedCheques: [
      { id: 'CHQ-1', payee: 'Zimbabwe Distance Education College', chequeNumber: '000412', amountUSD: 350, date: '2026-01-28' },
    ],
    preparedBy: 'Tendai Marufu',
    reviewedBy: 'Farai Chikanga',
    status: 'Approved',
  },
  {
    id: 'BREC-2026-02',
    bankAccountId: 'ACC-002',
    statementDate: '2026-02-28',
    statementBalanceUSD: 9975,
    bookBalanceUSD: 9600,
    depositsInTransit: [
      { id: 'DIT-2', description: 'SDC levy — late Feb deposit', amountUSD: 175, date: '2026-02-27' },
    ],
    unpresentedCheques: [
      { id: 'CHQ-2', payee: 'Harare Sports Equipment', chequeNumber: '000078', amountUSD: 350, date: '2026-02-20' },
      { id: 'CHQ-3', payee: 'Mbare Stationers', chequeNumber: '000079', amountUSD: 200, date: '2026-02-22' },
    ],
    preparedBy: 'Tendai Marufu',
    reviewedBy: '',
    status: 'Draft',
  },
]
