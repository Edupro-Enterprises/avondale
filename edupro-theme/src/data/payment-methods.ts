export type PaymentMethodType = 'Mobile Money' | 'Bank' | 'Cash'

export interface PaymentMethodConfig {
  id: string
  name: string
  type: PaymentMethodType
  reference: string
  active: boolean
}

export const mockPaymentMethods: PaymentMethodConfig[] = [
  { id: 'PM-001', name: 'EcoCash Merchant', type: 'Mobile Money', reference: '*151*2*4*8899#', active: true },
  { id: 'PM-002', name: 'CBZ Bank — General Account', type: 'Bank', reference: 'CBZ-4471-002', active: true },
  { id: 'PM-003', name: 'Stanbic Bank — SDC Account', type: 'Bank', reference: 'SBIC-8821-014', active: true },
  { id: 'PM-004', name: 'Cash Office', type: 'Cash', reference: 'Till 1', active: true },
]
