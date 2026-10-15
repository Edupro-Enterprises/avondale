/** Audit Log doctype access -- see the backend repo's
 * edupro_school_fees/doctype/audit_log/audit_log.json. Append-only: the
 * backend's on_trash/on_update both throw after insert, so there is no
 * edit/delete mutation here, only reads. `action` is free text (e.g. "User
 * login", "Invoice Submitted", "Payment Voucher workflow_state -> Approved"),
 * not a closed enum -- populated automatically from doc_events across the
 * app, not created directly by any UI. */
import { useQuery } from '@tanstack/react-query'
import { listResource } from './client'

export interface FrappeAuditLogEntry {
  name: string
  timestamp: string
  user: string
  role?: string
  action: string
  reference_doctype?: string
  reference_name?: string
  justification?: string
}

const AUDIT_LOG_FIELDS = ['name', 'timestamp', 'user', 'role', 'action', 'reference_doctype', 'reference_name', 'justification']

export function useAuditLog() {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const res = await listResource<FrappeAuditLogEntry>('Audit Log', {
        fields: JSON.stringify(AUDIT_LOG_FIELDS),
        order_by: 'timestamp desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

/** Frappe has no REST-listable "active sessions" doctype (session rows live
 * in a raw, non-permissioned tabSessions table) -- this repurposes the
 * "User login" audit trail as a "recent sign-ins" feed instead. */
export function useRecentSignIns() {
  return useQuery({
    queryKey: ['audit-log', 'recent-sign-ins'],
    queryFn: async () => {
      const res = await listResource<FrappeAuditLogEntry>('Audit Log', {
        fields: JSON.stringify(AUDIT_LOG_FIELDS),
        filters: JSON.stringify([['action', '=', 'User login']]),
        order_by: 'timestamp desc',
        limit_page_length: '50',
      })
      return res.data
    },
  })
}
