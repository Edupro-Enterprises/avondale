import { mockInvoices } from './invoices'

export type AgeingBucket = 'Current' | '1-30 Days' | '31-60 Days' | '60+ Days'

export type DebtorCaseStatus = 'Open' | 'Payment Plan Active' | 'Escalated' | 'Resolved'

export interface DebtorCase {
  id: string
  studentId: string
  studentName: string
  guardianName: string
  outstandingUSD: number
  ageingBucket: AgeingBucket
  status: DebtorCaseStatus
  assignedTo: string
  lastContact?: string
}

export const mockDebtorCases: DebtorCase[] = [
  {
    id: 'DC-2026-001',
    studentId: 'STU-2026-004',
    studentName: 'Tanaka Museva',
    guardianName: 'Rumbidzai Museva',
    outstandingUSD: 775,
    ageingBucket: '60+ Days',
    status: 'Escalated',
    assignedTo: 'Bursar',
    lastContact: '2026-02-01',
  },
  {
    id: 'DC-2026-002',
    studentId: 'STU-2026-008',
    studentName: 'Tapiwa Nyathi',
    guardianName: 'Memory Nyathi',
    outstandingUSD: 375,
    ageingBucket: '31-60 Days',
    status: 'Payment Plan Active',
    assignedTo: 'Bursar',
    lastContact: '2026-02-05',
  },
  {
    id: 'DC-2026-003',
    studentId: 'STU-2026-003',
    studentName: 'Kudakwashe Mavhunga',
    guardianName: 'Chipo Mavhunga',
    outstandingUSD: 375,
    ageingBucket: '1-30 Days',
    status: 'Open',
    assignedTo: 'Bursar',
  },
  {
    id: 'DC-2026-004',
    studentId: 'STU-2026-007',
    studentName: 'Vimbai Sithole',
    guardianName: 'Blessing Sithole',
    outstandingUSD: 375,
    ageingBucket: 'Current',
    status: 'Open',
    assignedTo: 'Bursar',
  },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const debtorCasesById = new Map(mockDebtorCases.map((c) => [c.id, c]))

/** Per-invoice breakdown of a case's outstanding balance, computed live
 * from invoices.ts rather than duplicated onto DebtorCase. */
export function getDebtItemsForCase(studentId: string) {
  return mockInvoices.filter((inv) => inv.studentId === studentId && inv.outstandingUSD > 0)
}

export type LegalActionType = 'Demand Letter' | 'Acknowledgment of Debt' | 'Small Claims Filing' | 'Court Order'

export interface LegalAction {
  id: string
  debtorCaseId: string
  actionType: LegalActionType
  date: string
  reference: string
  notes: string
}

export const mockLegalActions: LegalAction[] = [
  {
    id: 'LA-2026-001',
    debtorCaseId: 'DC-2026-001',
    actionType: 'Demand Letter',
    date: '2026-01-20',
    reference: 'DL-2026-0014',
    notes: 'Sent by registered post to the address on file, 14-day response window.',
  },
  {
    id: 'LA-2026-002',
    debtorCaseId: 'DC-2026-001',
    actionType: 'Acknowledgment of Debt',
    date: '2026-02-01',
    reference: 'AOD-2026-0009',
    notes: 'Guardian signed AoD, committing to a 3-instalment payment plan.',
  },
]

export interface CommunicationLogEntry {
  id: string
  debtorCaseId: string
  channel: 'Phone' | 'SMS' | 'Email' | 'In-Person'
  summary: string
  date: string
  loggedBy: string
}

export const mockCommunications: CommunicationLogEntry[] = [
  {
    id: 'COM-2026-001',
    debtorCaseId: 'DC-2026-001',
    channel: 'Phone',
    summary: 'Guardian requested a payment plan; awaiting written commitment.',
    date: '2026-02-01',
    loggedBy: 'Bursar',
  },
  {
    id: 'COM-2026-002',
    debtorCaseId: 'DC-2026-002',
    channel: 'SMS',
    summary: 'Reminder sent for the second installment, due in 5 days.',
    date: '2026-02-05',
    loggedBy: 'Bursar',
  },
]
