import type { Fund } from './budget-vote-lines'

export type VoucherStatus =
  | 'Pending Bursar'
  | 'Pending SDC Co-Approval'
  | 'Pending School Head'
  | 'Approved'
  | 'Disbursed'

export interface PaymentVoucher {
  id: string
  purchaseOrderId: string
  fund: Fund
  costCenterId: string
  amountUSD: number
  status: VoucherStatus
  requestedBy: string
  preparedBy: string
  bursarApprovedBy: string
  bursarApprovedDate: string
  sdcApprovedBy: string
  sdcApprovedDate: string
  headApprovedBy: string
  headApprovedDate: string
  paymentMethod: string
  disbursedDate: string
}

export const mockPaymentVouchers: PaymentVoucher[] = [
  {
    id: 'PV-2026-00001',
    purchaseOrderId: 'PO-2026-001',
    fund: 'Fund A — General/Government',
    costCenterId: 'CC-01',
    amountUSD: 320,
    status: 'Approved',
    requestedBy: 'Bursar',
    preparedBy: 'Tendai Marufu',
    bursarApprovedBy: 'Tendai Marufu',
    bursarApprovedDate: '2026-01-22',
    sdcApprovedBy: '',
    sdcApprovedDate: '',
    headApprovedBy: 'Dr. Simbarashe Moyana',
    headApprovedDate: '2026-01-23',
    paymentMethod: 'Bank Transfer',
    disbursedDate: '',
  },
  {
    id: 'PV-2026-00002',
    purchaseOrderId: 'PO-2026-001',
    fund: 'Fund B — SDC/SDA',
    costCenterId: 'CC-03',
    amountUSD: 600,
    status: 'Pending SDC Co-Approval',
    requestedBy: 'Bursar',
    preparedBy: 'Tendai Marufu',
    bursarApprovedBy: 'Tendai Marufu',
    bursarApprovedDate: '2026-02-04',
    sdcApprovedBy: '',
    sdcApprovedDate: '',
    headApprovedBy: '',
    headApprovedDate: '',
    paymentMethod: '',
    disbursedDate: '',
  },
]
