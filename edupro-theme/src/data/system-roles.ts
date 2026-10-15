export interface SystemRoleDefinition {
  id: string
  name: string
  description: string
  permissionsSummary: string
}

export const mockSystemRoles: SystemRoleDefinition[] = [
  {
    id: 'ROLE-BURSAR',
    name: 'Bursar',
    description: 'Full day-to-day financial operations.',
    permissionsSummary: 'Billing, cash office, debtors, procurement, finance and reports across both funds. No user/role administration.',
  },
  {
    id: 'ROLE-HEAD',
    name: 'School Head',
    description: 'Senior approver and oversight.',
    permissionsSummary: 'Approves receipt reversals and high-value payment vouchers, views all reports read-only. No transaction entry.',
  },
  {
    id: 'ROLE-SDC',
    name: 'SDC Chairperson',
    description: 'Community oversight of Fund B (SDC/SDA).',
    permissionsSummary: 'Co-approves Fund B payment vouchers, views Fund B budget/journal/debtors. No access to Fund A.',
  },
  {
    id: 'ROLE-PARENT',
    name: 'Parent',
    description: 'Guardian self-service portal.',
    permissionsSummary: "View and pay fees for their own linked children only. No access to other students' records.",
  },
  {
    id: 'ROLE-STUDENT',
    name: 'Student',
    description: 'Student self-service portal.',
    permissionsSummary: 'View their own balance, statement, and payment plan only.',
  },
  {
    id: 'ROLE-ADMIN',
    name: 'System Admin',
    description: 'Platform administration.',
    permissionsSummary: 'Manages user accounts, roles, active sessions, and the audit log. No access to financial transaction entry.',
  },
]
