export type PurchaseOrderStatus = 'Issued' | 'Delivered' | 'Invoiced'

export interface PurchaseOrder {
  id: string
  requisitionId: string
  costCenterId: string
  vendor: string
  amountUSD: number
  status: PurchaseOrderStatus
  issuedDate: string
  expectedDeliveryDate: string
  actualDeliveryDate: string
  deliveryNote: string
}

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-2026-001',
    requisitionId: 'REQ-2026-001',
    costCenterId: 'CC-01',
    vendor: 'Harare Stationers (Pvt) Ltd',
    amountUSD: 320,
    status: 'Delivered',
    issuedDate: '2026-01-22',
    expectedDeliveryDate: '2026-01-25',
    actualDeliveryDate: '2026-01-24',
    deliveryNote: "Delivered to the Bursar's office, signed for by Tendai Marufu.",
  },
]
