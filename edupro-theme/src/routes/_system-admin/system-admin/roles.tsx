import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SystemAdminHeader } from '@/components/layout/system-admin-header'
import { ROLE_LABELS, type EduproRole } from '@/lib/frappe/roles'

export const Route = createFileRoute('/_system-admin/system-admin/roles')({
  component: RolesPage,
})

const ROLE_DESCRIPTIONS: Record<EduproRole, string> = {
  Bursar: 'Day-to-day cashiering and record-keeping: students, invoices, receipts, fee structures, payment vouchers, journal entries, debtor cases.',
  'Fees Approver': 'Signs off on fee structures before they take effect.',
  'School Head': 'Final approval on payment vouchers and receipt reversals; read access across both funds and the student roster; can close a budget vote book period.',
  'SDC Chairperson/Treasurer': 'Co-approves payment vouchers and oversees budget/ledger activity, scoped to Fund B (SDC/SDA) only.',
  'District Education Auditor/Inspector': 'Independent oversight co-signature on sensitive-value procurement; read access to the audit trail.',
  'Parent/Guardian': 'Portal access to their own linked children\'s fee statements, payment plans, and receipts.',
  Student: 'Portal access to their own fee statement and payment plan.',
  'System Manager': 'Full administrative access: user accounts, roles, and the audit log.',
}

function RolesPage() {
  const roles = Object.keys(ROLE_LABELS) as EduproRole[]

  return (
    <>
      <SystemAdminHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Access Control</p>
          <h1 className='text-3xl font-bold tracking-tight'>Roles</h1>
          <p className='text-sm text-muted-foreground'>A reference guide to what each role can access — roles themselves are fixed, not user-editable.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          {roles.map((r) => (
            <Card key={r}>
              <CardHeader>
                <CardTitle>{ROLE_LABELS[r]}</CardTitle>
                <CardDescription>{r}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>{ROLE_DESCRIPTIONS[r]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
