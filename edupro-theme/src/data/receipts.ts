export type ReceiptStatus = 'Posted' | 'Reversal Pending' | 'Reversed'

export type PaymentMethod = 'EcoCash' | 'Bank Transfer' | 'Cash'

export type ReceiptCurrency = 'USD' | 'ZiG'

export interface Receipt {
  id: string
  batchId: string
  invoiceId: string
  studentId: string
  studentName: string
  /** USD-equivalent, computed once at posting time using the exchange rate
   * active then -- the canonical figure every list/report/aggregate uses. */
  amountUSD: number
  /** What was actually received, in its own currency -- only meaningfully
   * different from amountUSD when currencyReceived is 'ZiG'. */
  currencyReceived: ReceiptCurrency
  amountReceivedInCurrency: number
  method: PaymentMethod
  status: ReceiptStatus
  date: string
  receivedBy: string
  reversalReason: string
  reversalRequestedBy: string
  reversalApprovedBy: string
  reversalDate: string
}

export const mockReceipts: Receipt[] = [
  {
    id: 'RCT-2026-00089',
    batchId: 'BATCH-2026-02-10-BURSAR',
    invoiceId: 'INV-2026-00147',
    studentId: 'STU-2026-001',
    studentName: 'Tadiwa Moyo Jr.',
    amountUSD: 175,
    currencyReceived: 'USD',
    amountReceivedInCurrency: 175,
    method: 'EcoCash',
    status: 'Posted',
    date: '2026-02-10',
    receivedBy: 'Bursar',
    reversalReason: '',
    reversalRequestedBy: '',
    reversalApprovedBy: '',
    reversalDate: '',
  },
  {
    id: 'RCT-2026-00090',
    batchId: 'BATCH-2026-01-12-BURSAR',
    invoiceId: 'INV-2026-00148',
    studentId: 'STU-2026-002',
    studentName: 'Rutendo Chikafu',
    amountUSD: 375,
    currencyReceived: 'USD',
    amountReceivedInCurrency: 375,
    method: 'Bank Transfer',
    status: 'Posted',
    date: '2026-01-12',
    receivedBy: 'Bursar',
    reversalReason: '',
    reversalRequestedBy: '',
    reversalApprovedBy: '',
    reversalDate: '',
  },
  {
    id: 'RCT-2026-00091',
    batchId: 'BATCH-2025-09-05-BURSAR',
    invoiceId: 'INV-2026-00150',
    studentId: 'STU-2026-004',
    studentName: 'Tanaka Museva',
    amountUSD: 375,
    currencyReceived: 'USD',
    amountReceivedInCurrency: 375,
    method: 'Bank Transfer',
    status: 'Reversal Pending',
    date: '2025-09-05',
    receivedBy: 'Bursar',
    reversalReason: 'Posted against the wrong invoice — should have been Term 2',
    reversalRequestedBy: 'Tendai Marufu',
    reversalApprovedBy: '',
    reversalDate: '',
  },
  {
    id: 'RCT-2026-00092',
    batchId: 'BATCH-2026-01-14-BURSAR',
    invoiceId: 'INV-2026-00151',
    studentId: 'STU-2026-005',
    studentName: 'Anesu Gwaze',
    amountUSD: 375,
    currencyReceived: 'USD',
    amountReceivedInCurrency: 375,
    method: 'Cash',
    status: 'Posted',
    date: '2026-01-14',
    receivedBy: 'Bursar',
    reversalReason: '',
    reversalRequestedBy: '',
    reversalApprovedBy: '',
    reversalDate: '',
  },
  {
    id: 'RCT-2026-00093',
    batchId: 'BATCH-2026-02-01-BURSAR',
    invoiceId: 'INV-2026-00152',
    studentId: 'STU-2026-006',
    studentName: 'Nyasha Chirwa',
    amountUSD: 225,
    currencyReceived: 'ZiG',
    amountReceivedInCurrency: 6075,
    method: 'EcoCash',
    status: 'Posted',
    date: '2026-02-01',
    receivedBy: 'Bursar',
    reversalReason: '',
    reversalRequestedBy: '',
    reversalApprovedBy: '',
    reversalDate: '',
  },
]
