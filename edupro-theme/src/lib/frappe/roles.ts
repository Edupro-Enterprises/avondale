import type { FileRouteTypes } from '@/routeTree.gen'

/**
 * The reconciled 7-persona RBAC matrix from the backend spec, plus the
 * Fees Approver role already wired into its Fee Structure workflow. See
 * the backend repo's docs/decisions/0005-internal-rbac-desk-roles.md for
 * the mapping (System Administrator -> System Manager, no separate role).
 * Ported from `web/src/lib/roles.ts` for consistency with the real backend.
 */
export type EduproRole =
  | 'Bursar'
  | 'Fees Approver'
  | 'School Head'
  | 'SDC Chairperson/Treasurer'
  | 'District Education Auditor/Inspector'
  | 'Parent/Guardian'
  | 'Student'
  | 'System Manager'

export const ROLE_LABELS: Record<EduproRole, string> = {
  Bursar: 'Bursar',
  'Fees Approver': 'Fees Approver',
  'School Head': 'School Head',
  'SDC Chairperson/Treasurer': 'SDC Chairperson/Treasurer',
  'District Education Auditor/Inspector': 'District Auditor',
  'Parent/Guardian': 'Parent',
  Student: 'Student',
  'System Manager': 'System Administrator',
}

/** Which of edupro-theme's 6 role shells (if any) a given backend role
 * lands on. Fees Approver and District Education Auditor/Inspector have
 * real DocPerm rows on the backend but no dashboard here yet (explicitly
 * out of scope for this integration pass) -- they resolve to `null`,
 * which the login flow treats as "no shell built for you yet" rather than
 * silently 404ing or guessing a fallback. */
export const ROLE_HOME: Record<EduproRole, FileRouteTypes['to'] | null> = {
  Bursar: '/bursar',
  'School Head': '/school-head',
  'SDC Chairperson/Treasurer': '/sdc',
  'System Manager': '/system-admin',
  'Parent/Guardian': '/portal',
  Student: '/student',
  'Fees Approver': null,
  'District Education Auditor/Inspector': null,
}

/** A user can hold more than one backend role; the shell renders nav for
 * the highest-privilege one it recognises. */
const ROLE_PRIORITY: EduproRole[] = [
  'System Manager',
  'School Head',
  'SDC Chairperson/Treasurer',
  'Fees Approver',
  'Bursar',
  'District Education Auditor/Inspector',
  'Parent/Guardian',
  'Student',
]

export function primaryRole(roles: string[]): EduproRole | null {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null
}
