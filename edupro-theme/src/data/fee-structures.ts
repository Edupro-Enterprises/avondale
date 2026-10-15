/** Governance-gated: Bursar drafts -> SDC reviews -> Fees Approver signs off. */
export type FeeStructureStatus = 'Draft' | 'Pending SDC Review' | 'Pending Approval' | 'Approved'

export type AcceptedCurrency = 'USD' | 'ZiG'

export interface FeeStructureLine {
  item: string
  amountUSD: number
  taxable: boolean
  chartOfAccountId: string
}

export interface FeeStructure {
  id: string
  name: string
  academicYear: string
  term: string
  status: FeeStructureStatus
  version: number
  supersedesId: string
  acceptedCurrencies: AcceptedCurrency[]
  totalUSD: number
  lines: FeeStructureLine[]
  draftedBy: string
  sdcReviewedBy: string
  sdcReviewDate: string
  approvedBy?: string
  approvedDate?: string
}

export const mockFeeStructures: FeeStructure[] = [
  {
    id: 'FS-2026-T1',
    name: 'Day Scholar — Term 1 Fees',
    academicYear: '2026 Academic Year',
    term: 'Term 1',
    status: 'Approved',
    version: 1,
    supersedesId: '',
    acceptedCurrencies: ['USD', 'ZiG'],
    totalUSD: 375,
    lines: [
      { item: 'Tuition', amountUSD: 150, taxable: false, chartOfAccountId: 'COA-4000' },
      { item: 'SDC Levy', amountUSD: 200, taxable: false, chartOfAccountId: 'COA-4010' },
      { item: 'Science Practical', amountUSD: 25, taxable: false, chartOfAccountId: 'COA-4000' },
    ],
    draftedBy: 'Bursar',
    sdcReviewedBy: 'Grace Mutasa',
    sdcReviewDate: '2025-12-10',
    approvedBy: 'Fees Approver',
    approvedDate: '2025-12-18',
  },
  {
    id: 'FS-2026-T1-BOARD',
    name: 'Boarding — Term 1 Fees',
    academicYear: '2026 Academic Year',
    term: 'Term 1',
    status: 'Approved',
    version: 1,
    supersedesId: '',
    acceptedCurrencies: ['USD'],
    totalUSD: 775,
    lines: [
      { item: 'Tuition', amountUSD: 150, taxable: false, chartOfAccountId: 'COA-4000' },
      { item: 'SDC Levy', amountUSD: 200, taxable: false, chartOfAccountId: 'COA-4010' },
      { item: 'Science Practical', amountUSD: 25, taxable: false, chartOfAccountId: 'COA-4000' },
      { item: 'Boarding', amountUSD: 400, taxable: false, chartOfAccountId: 'COA-4020' },
    ],
    draftedBy: 'Bursar',
    sdcReviewedBy: 'Grace Mutasa',
    sdcReviewDate: '2025-12-10',
    approvedBy: 'Fees Approver',
    approvedDate: '2025-12-18',
  },
  {
    id: 'FS-2026-T2',
    name: 'Day Scholar — Term 2 Fees',
    academicYear: '2026 Academic Year',
    term: 'Term 2',
    status: 'Pending Approval',
    version: 1,
    supersedesId: '',
    acceptedCurrencies: ['USD', 'ZiG'],
    totalUSD: 385,
    lines: [
      { item: 'Tuition', amountUSD: 155, taxable: false, chartOfAccountId: 'COA-4000' },
      { item: 'SDC Levy', amountUSD: 205, taxable: false, chartOfAccountId: 'COA-4010' },
      { item: 'Science Practical', amountUSD: 25, taxable: false, chartOfAccountId: 'COA-4000' },
    ],
    draftedBy: 'Bursar',
    sdcReviewedBy: 'Grace Mutasa',
    sdcReviewDate: '2026-04-02',
  },
  {
    id: 'FS-2026-T2-DRAFT',
    name: 'Form 6 Exam Fee — Term 2',
    academicYear: '2026 Academic Year',
    term: 'Term 2',
    status: 'Draft',
    version: 1,
    supersedesId: '',
    acceptedCurrencies: ['USD'],
    totalUSD: 90,
    lines: [{ item: 'ZIMSEC Registration', amountUSD: 90, taxable: false, chartOfAccountId: 'COA-4000' }],
    draftedBy: 'Bursar',
    sdcReviewedBy: '',
    sdcReviewDate: '',
  },
  {
    id: 'FS-2026-T1-SHOP',
    name: 'School Shop Uniform Pack — Term 1',
    academicYear: '2026 Academic Year',
    term: 'Term 1',
    status: 'Approved',
    version: 2,
    supersedesId: 'FS-2025-T1-SHOP',
    acceptedCurrencies: ['USD'],
    totalUSD: 60,
    lines: [
      { item: 'Uniform Set', amountUSD: 45, taxable: true, chartOfAccountId: 'COA-4030' },
      { item: 'PE Kit', amountUSD: 15, taxable: true, chartOfAccountId: 'COA-4030' },
    ],
    draftedBy: 'Bursar',
    sdcReviewedBy: 'Grace Mutasa',
    sdcReviewDate: '2025-12-10',
    approvedBy: 'Fees Approver',
    approvedDate: '2025-12-18',
  },
]
