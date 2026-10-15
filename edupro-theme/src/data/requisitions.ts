export type RequisitionStatus = 'Draft' | 'Pending Quotes' | 'Approved' | 'Converted to PO' | 'Rejected'

export interface Quotation {
  vendor: string
  amountUSD: number
  quotationDate: string
}

export interface Requisition {
  id: string
  description: string
  voteLineId: string
  costCenterId: string
  requestedBy: string
  amountUSD: number
  status: RequisitionStatus
  date: string
  /** PRAZ compliance requires 3 quotes above the configured threshold. */
  quotations: Quotation[]
  prazReferenceNumber: string
}

export const mockRequisitions: Requisition[] = [
  {
    id: 'REQ-2026-001',
    description: 'Exercise books and stationery — Term 1 restock',
    voteLineId: 'VOTE-03',
    costCenterId: 'CC-01',
    requestedBy: 'Bursar',
    amountUSD: 320,
    status: 'Converted to PO',
    date: '2026-01-20',
    quotations: [
      { vendor: 'Harare Stationers (Pvt) Ltd', amountUSD: 320, quotationDate: '2026-01-18' },
      { vendor: 'Metro Office Supplies', amountUSD: 345, quotationDate: '2026-01-18' },
      { vendor: 'CBZ Business Solutions', amountUSD: 360, quotationDate: '2026-01-19' },
    ],
    prazReferenceNumber: 'PRAZ-2026-0041',
  },
  {
    id: 'REQ-2026-002',
    description: 'Boarding house kitchen repairs',
    voteLineId: 'VOTE-05',
    costCenterId: 'CC-03',
    requestedBy: 'Bursar',
    amountUSD: 600,
    status: 'Pending Quotes',
    date: '2026-02-03',
    quotations: [{ vendor: 'Ridgeway Hardware', amountUSD: 600, quotationDate: '2026-02-03' }],
    prazReferenceNumber: '',
  },
  {
    id: 'REQ-2026-003',
    description: 'Classroom block — cement and roofing sheets',
    voteLineId: 'VOTE-06',
    costCenterId: 'CC-06',
    requestedBy: 'School Head',
    amountUSD: 4000,
    status: 'Approved',
    date: '2026-01-28',
    quotations: [
      { vendor: 'PPC Zimbabwe', amountUSD: 4000, quotationDate: '2026-01-25' },
      { vendor: 'Masimba Building Supplies', amountUSD: 4150, quotationDate: '2026-01-26' },
      { vendor: 'Steelmakers Zimbabwe', amountUSD: 4300, quotationDate: '2026-01-26' },
    ],
    prazReferenceNumber: 'PRAZ-2026-0052',
  },
]
