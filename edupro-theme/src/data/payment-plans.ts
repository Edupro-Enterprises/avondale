export type InstallmentStatus = 'Paid' | 'Due' | 'Overdue'

export interface PaymentPlanInstallment {
  id: string
  dueDate: string
  amountUSD: number
  status: InstallmentStatus
}

export type PaymentPlanStatus = 'Active' | 'Completed' | 'Defaulted'

export interface PaymentPlan {
  id: string
  studentId: string
  studentName: string
  totalUSD: number
  status: PaymentPlanStatus
  installments: PaymentPlanInstallment[]
}

export const mockPaymentPlans: PaymentPlan[] = [
  {
    id: 'PP-2026-001',
    studentId: 'STU-2026-008',
    studentName: 'Tapiwa Nyathi',
    totalUSD: 375,
    status: 'Active',
    installments: [
      { id: 'PP-2026-001-1', dueDate: '2026-01-15', amountUSD: 125, status: 'Paid' },
      { id: 'PP-2026-001-2', dueDate: '2026-02-15', amountUSD: 125, status: 'Due' },
      { id: 'PP-2026-001-3', dueDate: '2026-03-15', amountUSD: 125, status: 'Due' },
    ],
  },
  {
    id: 'PP-2026-002',
    studentId: 'STU-2026-001',
    studentName: 'Tadiwa Moyo Jr.',
    totalUSD: 375,
    status: 'Active',
    installments: [
      { id: 'PP-2026-002-1', dueDate: '2026-01-10', amountUSD: 175, status: 'Paid' },
      { id: 'PP-2026-002-2', dueDate: '2026-02-28', amountUSD: 200, status: 'Due' },
    ],
  },
]
