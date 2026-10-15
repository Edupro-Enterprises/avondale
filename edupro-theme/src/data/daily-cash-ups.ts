import type { PaymentMethod } from './receipts'

export type CashUpStatus = 'Draft' | 'Submitted' | 'Approved'

export interface CashUpLine {
  method: PaymentMethod
  expectedUSD: number
  actualUSD: number
}

export interface DailyCashUp {
  id: string
  date: string
  cashierName: string
  supervisorName: string
  headName: string
  lines: CashUpLine[]
  status: CashUpStatus
  cashierConfirmed: boolean
  supervisorConfirmed: boolean
  headConfirmed: boolean
  notes: string
}

export const mockDailyCashUps: DailyCashUp[] = [
  {
    id: 'CU-2026-02-10',
    date: '2026-02-10',
    cashierName: 'Tendai Marufu',
    supervisorName: 'Farai Chikanga',
    headName: '',
    lines: [
      { method: 'Cash', expectedUSD: 240, actualUSD: 240 },
      { method: 'EcoCash', expectedUSD: 175, actualUSD: 175 },
      { method: 'Bank Transfer', expectedUSD: 0, actualUSD: 0 },
    ],
    status: 'Approved',
    cashierConfirmed: true,
    supervisorConfirmed: true,
    headConfirmed: false,
    notes: '',
  },
  {
    id: 'CU-2026-02-01',
    date: '2026-02-01',
    cashierName: 'Tendai Marufu',
    supervisorName: 'Farai Chikanga',
    headName: 'Dr. Simbarashe Moyana',
    lines: [
      { method: 'Cash', expectedUSD: 180, actualUSD: 165 },
      { method: 'EcoCash', expectedUSD: 225, actualUSD: 225 },
      { method: 'Bank Transfer', expectedUSD: 0, actualUSD: 0 },
    ],
    status: 'Approved',
    cashierConfirmed: true,
    supervisorConfirmed: true,
    headConfirmed: true,
    notes: 'Cash short by $15 — till roll shows a duplicate change count, referred to School Head.',
  },
  {
    id: 'CU-2026-01-14',
    date: '2026-01-14',
    cashierName: 'Tendai Marufu',
    supervisorName: 'Farai Chikanga',
    headName: '',
    lines: [
      { method: 'Cash', expectedUSD: 375, actualUSD: 375 },
      { method: 'EcoCash', expectedUSD: 0, actualUSD: 0 },
      { method: 'Bank Transfer', expectedUSD: 0, actualUSD: 0 },
    ],
    status: 'Approved',
    cashierConfirmed: true,
    supervisorConfirmed: true,
    headConfirmed: false,
    notes: '',
  },
]

/** Today's reference figures a cashier reconciles against — in the real
 * system this comes from the day's posted receipts; here it's seeded for
 * the New Cash-Up form since there's no backend to derive it from. */
export const todayExpected: CashUpLine[] = [
  { method: 'Cash', expectedUSD: 200, actualUSD: 0 },
  { method: 'EcoCash', expectedUSD: 150, actualUSD: 0 },
  { method: 'Bank Transfer', expectedUSD: 0, actualUSD: 0 },
]
