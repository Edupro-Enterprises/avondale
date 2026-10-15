/** Mirrors src/lib/frappe/roles.ts's EduproRole/ROLE_HOME -- kept as a
 * separate flat list here (not imported from src/) since Playwright specs
 * run outside the Vite/TS app build and importing app source would drag
 * in the whole module graph. Keep this in sync if roles.ts changes. */
export interface RoleFixture {
  /** Key used for E2E_<KEY>_EMAIL / E2E_<KEY>_PASSWORD env vars. */
  envKey: string
  role: string
  /** null = no shell exists for this role today (Fees Approver, District Auditor) -- login should land back on /sign-in. */
  home: string | null
  /** A couple of nav items to smoke-test, {label, path}. Empty for roles with no shell. */
  nav: { label: string; path: string }[]
}

export const ROLES: RoleFixture[] = [
  {
    envKey: 'BURSAR',
    role: 'Bursar',
    home: '/bursar',
    nav: [
      { label: 'Students', path: '/bursar/students' },
      { label: 'Fee Structures', path: '/bursar/billing/fee-structures' },
      { label: 'Invoices', path: '/bursar/billing/invoices' },
      { label: 'Receipts', path: '/bursar/cash-office/receipts' },
      { label: 'Debtor Cases', path: '/bursar/debtors/cases' },
      { label: 'Journal Entries', path: '/bursar/finance/journal-entries' },
      { label: 'Budget Vote Book', path: '/bursar/finance/budget-vote-book' },
      { label: 'Institution Profile', path: '/bursar/school-setup/institution-profile' },
      { label: 'Requisitions', path: '/bursar/procurement/requisitions' },
      { label: 'Applicants', path: '/bursar/admissions/applicants' },
    ],
  },
  {
    envKey: 'SCHOOL_HEAD',
    role: 'School Head',
    home: '/school-head',
    nav: [
      { label: 'Students', path: '/school-head/students' },
      { label: 'Fee Structures', path: '/school-head/fee-structures' },
      { label: 'Payment Vouchers', path: '/school-head/payment-vouchers' },
      { label: 'Receipt Reversals', path: '/school-head/receipt-reversals' },
      { label: 'Budget Vote Book', path: '/school-head/budget-vote-book' },
      { label: 'Reports', path: '/school-head/reports' },
    ],
  },
  {
    envKey: 'SDC',
    role: 'SDC Chairperson/Treasurer',
    home: '/sdc',
    nav: [
      { label: 'Debtors', path: '/sdc/debtors' },
      { label: 'Payment Vouchers', path: '/sdc/payment-vouchers' },
      { label: 'Journal Entries', path: '/sdc/journal-entries' },
      { label: 'Budget Vote Book', path: '/sdc/budget-vote-book' },
      { label: 'Reports', path: '/sdc/reports' },
    ],
  },
  {
    envKey: 'SYSTEM_ADMIN',
    role: 'System Manager',
    home: '/system-admin',
    nav: [
      { label: 'Users', path: '/system-admin/users' },
      { label: 'Roles', path: '/system-admin/roles' },
      { label: 'Sessions', path: '/system-admin/sessions' },
      { label: 'Audit Log', path: '/system-admin/audit-log' },
    ],
  },
  {
    envKey: 'STUDENT',
    role: 'Student',
    home: '/student',
    nav: [
      { label: 'Statement', path: '/student/statement' },
      { label: 'Payment Plan', path: '/student/payment-plan' },
      { label: 'Settings', path: '/student/settings' },
    ],
  },
  {
    envKey: 'PARENT',
    role: 'Parent/Guardian',
    home: '/portal',
    nav: [
      { label: 'Children', path: '/portal/students' },
      { label: 'Pay', path: '/portal/pay' },
      { label: 'History', path: '/portal/payments' },
      { label: 'Settings', path: '/portal/settings' },
    ],
  },
  {
    envKey: 'FEES_APPROVER',
    role: 'Fees Approver',
    home: null,
    nav: [],
  },
  {
    envKey: 'DISTRICT_AUDITOR',
    role: 'District Education Auditor/Inspector',
    home: null,
    nav: [],
  },
]

export function credsFor(envKey: string): { email: string; password: string } | null {
  const email = process.env[`E2E_${envKey}_EMAIL`]
  const password = process.env[`E2E_${envKey}_PASSWORD`]
  if (!email || !password) return null
  return { email, password }
}
