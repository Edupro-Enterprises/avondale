export type AuditAction = 'Create' | 'Update' | 'Delete' | 'Approve' | 'Reject' | 'Login' | 'Logout'

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  action: AuditAction
  entity: string
  entityId: string
  description: string
}

export const mockAuditLog: AuditLogEntry[] = [
  { id: 'AUD-0001', timestamp: '2026-09-14 08:12', actor: 'Tendai Marufu', action: 'Login', entity: 'Session', entityId: 'SESS-1001', description: 'Signed in to the Bursar desk.' },
  { id: 'AUD-0002', timestamp: '2026-02-10 09:03', actor: 'Tendai Marufu', action: 'Create', entity: 'Receipt', entityId: 'RCT-2026-00089', description: 'Posted a receipt for Tadiwa Moyo Jr.' },
  { id: 'AUD-0003', timestamp: '2026-02-01 14:20', actor: 'Dr. Simbarashe Moyana', action: 'Approve', entity: 'PaymentVoucher', entityId: 'PV-2026-00001', description: 'Approved payment voucher for Harare Stationers.' },
  { id: 'AUD-0004', timestamp: '2025-12-18 11:45', actor: 'Grace Mutasa', action: 'Approve', entity: 'FeeStructure', entityId: 'FS-2026-T1', description: 'SDC-reviewed the Day Scholar Term 1 fee structure.' },
  { id: 'AUD-0005', timestamp: '2026-02-01 10:15', actor: 'Grace Mutasa', action: 'Update', entity: 'DebtorCase', entityId: 'DC-2026-001', description: "Logged a guardian's payment plan request." },
  { id: 'AUD-0006', timestamp: '2026-08-30 16:02', actor: 'Chipo Mavhunga', action: 'Login', entity: 'Session', entityId: 'SESS-2214', description: 'Parent portal login.' },
  { id: 'AUD-0007', timestamp: '2026-01-22 09:40', actor: 'Tendai Marufu', action: 'Create', entity: 'PurchaseOrder', entityId: 'PO-2026-001', description: 'Issued PO to Harare Stationers (Pvt) Ltd.' },
  { id: 'AUD-0008', timestamp: '2026-08-20 13:10', actor: 'Kudzai Mangwiro', action: 'Create', entity: 'User', entityId: 'USR-008', description: 'Invited Tafadzwa Chirwa (Parent) to the portal.' },
  { id: 'AUD-0009', timestamp: '2026-06-05 08:55', actor: 'Kudzai Mangwiro', action: 'Update', entity: 'User', entityId: 'USR-009', description: 'Suspended Memory Nyathi\'s portal account pending identity verification.' },
  { id: 'AUD-0010', timestamp: '2026-09-11 15:30', actor: 'Farai Chikafu', action: 'Logout', entity: 'Session', entityId: 'SESS-3087', description: 'Parent portal session ended.' },
]
