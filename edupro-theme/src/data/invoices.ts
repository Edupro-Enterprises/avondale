export type InvoiceStatus = 'paid' | 'partial' | 'overdue' | 'pending'

export interface InvoiceLineItem {
  item: string
  amountUSD: number
  taxable: boolean
}

export interface Invoice {
  id: string
  studentId: string
  studentName: string
  feeStructureId: string
  feeStructureVersion: number
  term: string
  lineItems: InvoiceLineItem[]
  amountUSD: number
  taxAmountUSD: number
  outstandingUSD: number
  status: InvoiceStatus
  dueDate: string
  issuedDate: string
  issuedBy: string
  voidedDate: string
  voidedBy: string
}

export const mockInvoices: Invoice[] = [
  {
    id: 'INV-2026-00147',
    studentId: 'STU-2026-001',
    studentName: 'Tadiwa Moyo Jr.',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 200,
    status: 'partial',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-08',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00148',
    studentId: 'STU-2026-002',
    studentName: 'Rutendo Chikafu',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 0,
    status: 'paid',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-08',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00149',
    studentId: 'STU-2026-003',
    studentName: 'Kudakwashe Mavhunga',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 375,
    status: 'pending',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-08',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00150',
    studentId: 'STU-2026-004',
    studentName: 'Tanaka Museva',
    feeStructureId: 'FS-2026-T1-BOARD',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
      { item: 'Boarding', amountUSD: 400, taxable: false },
    ],
    amountUSD: 775,
    taxAmountUSD: 0,
    outstandingUSD: 775,
    status: 'overdue',
    dueDate: '2026-01-31',
    issuedDate: '2025-12-20',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00151',
    studentId: 'STU-2026-005',
    studentName: 'Anesu Gwaze',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 0,
    status: 'paid',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-08',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00152',
    studentId: 'STU-2026-006',
    studentName: 'Nyasha Chirwa',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 150,
    status: 'partial',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-08',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00153',
    studentId: 'STU-2026-007',
    studentName: 'Vimbai Sithole',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 375,
    status: 'pending',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-08',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00154',
    studentId: 'STU-2026-008',
    studentName: 'Tapiwa Nyathi',
    feeStructureId: 'FS-2026-T1',
    feeStructureVersion: 1,
    term: 'Term 1',
    lineItems: [
      { item: 'Tuition', amountUSD: 150, taxable: false },
      { item: 'SDC Levy', amountUSD: 200, taxable: false },
      { item: 'Science Practical', amountUSD: 25, taxable: false },
    ],
    amountUSD: 375,
    taxAmountUSD: 0,
    outstandingUSD: 375,
    status: 'overdue',
    dueDate: '2026-01-31',
    issuedDate: '2025-12-20',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
  {
    id: 'INV-2026-00155',
    studentId: 'STU-2026-001',
    studentName: 'Tadiwa Moyo Jr.',
    feeStructureId: 'FS-2026-T1-SHOP',
    feeStructureVersion: 2,
    term: 'Term 1',
    lineItems: [
      { item: 'Uniform Set', amountUSD: 45, taxable: true },
      { item: 'PE Kit', amountUSD: 15, taxable: true },
    ],
    amountUSD: 60,
    taxAmountUSD: 9,
    outstandingUSD: 60,
    status: 'pending',
    dueDate: '2026-02-15',
    issuedDate: '2026-01-15',
    issuedBy: 'Tendai Marufu',
    voidedDate: '',
    voidedBy: '',
  },
]
