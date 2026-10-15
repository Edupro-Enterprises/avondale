export type StudentFeeStatus = 'paid' | 'partial' | 'overdue' | 'pending'

export type BeneficiaryCategory = 'Self-sponsored' | 'BEAM' | 'Staff' | 'Trust-Scholarship'

export interface Student {
  id: string
  name: string
  form: string
  beneficiaryCategory: BeneficiaryCategory
  status: StudentFeeStatus
  balanceUSD: number
  email: string
  enrollmentDate: string
}

export const mockStudents: Student[] = [
  {
    id: 'STU-2026-001',
    name: 'Tadiwa Moyo Jr.',
    form: 'Form 2A',
    beneficiaryCategory: 'Self-sponsored',
    status: 'partial',
    balanceUSD: 200,
    email: 'tadiwa.moyo@mbarehigh.edu.zw',
    enrollmentDate: '2024-01-15',
  },
  {
    id: 'STU-2026-002',
    name: 'Rutendo Chikafu',
    form: 'Form 4B',
    beneficiaryCategory: 'Self-sponsored',
    status: 'paid',
    balanceUSD: 0,
    email: 'rutendo.chikafu@mbarehigh.edu.zw',
    enrollmentDate: '2022-01-10',
  },
  {
    id: 'STU-2026-003',
    name: 'Kudakwashe Mavhunga',
    form: 'Form 1C',
    beneficiaryCategory: 'BEAM',
    status: 'pending',
    balanceUSD: 375,
    email: 'kudakwashe.mavhunga@mbarehigh.edu.zw',
    enrollmentDate: '2026-01-20',
  },
  {
    id: 'STU-2026-004',
    name: 'Tanaka Museva',
    form: 'Form 6A',
    beneficiaryCategory: 'Trust-Scholarship',
    status: 'overdue',
    balanceUSD: 775,
    email: 'tanaka.museva@mbarehigh.edu.zw',
    enrollmentDate: '2020-01-12',
  },
  {
    id: 'STU-2026-005',
    name: 'Anesu Gwaze',
    form: 'Form 3A',
    beneficiaryCategory: 'Staff',
    status: 'paid',
    balanceUSD: 0,
    email: 'anesu.gwaze@mbarehigh.edu.zw',
    enrollmentDate: '2023-01-16',
  },
  {
    id: 'STU-2026-006',
    name: 'Nyasha Chirwa',
    form: 'Form 2A',
    beneficiaryCategory: 'Self-sponsored',
    status: 'partial',
    balanceUSD: 150,
    email: 'nyasha.chirwa@mbarehigh.edu.zw',
    enrollmentDate: '2024-01-15',
  },
  {
    id: 'STU-2026-007',
    name: 'Vimbai Sithole',
    form: 'Form 5B',
    beneficiaryCategory: 'Self-sponsored',
    status: 'pending',
    balanceUSD: 375,
    email: 'vimbai.sithole@mbarehigh.edu.zw',
    enrollmentDate: '2021-01-11',
  },
  {
    id: 'STU-2026-008',
    name: 'Tapiwa Nyathi',
    form: 'Form 1A',
    beneficiaryCategory: 'BEAM',
    status: 'overdue',
    balanceUSD: 375,
    email: 'tapiwa.nyathi@mbarehigh.edu.zw',
    enrollmentDate: '2026-01-20',
  },
]

export interface PaymentHistoryEntry {
  id: string
  date: string
  amountUSD: number
  method: string
  status: 'completed' | 'pending'
}

export const mockPaymentHistory: Record<string, PaymentHistoryEntry[]> = {
  'STU-2026-001': [{ id: 'PMT-1001', date: '2026-02-10', amountUSD: 175, method: 'EcoCash', status: 'completed' }],
  'STU-2026-002': [
    { id: 'PMT-2001', date: '2026-01-12', amountUSD: 375, method: 'Bank Transfer', status: 'completed' },
  ],
  'STU-2026-003': [],
  'STU-2026-004': [{ id: 'PMT-4001', date: '2025-09-05', amountUSD: 375, method: 'Bank Transfer', status: 'completed' }],
  'STU-2026-005': [{ id: 'PMT-5001', date: '2026-01-14', amountUSD: 375, method: 'Cash', status: 'completed' }],
  'STU-2026-006': [{ id: 'PMT-6001', date: '2026-02-01', amountUSD: 225, method: 'EcoCash', status: 'completed' }],
  'STU-2026-007': [],
  'STU-2026-008': [],
}
