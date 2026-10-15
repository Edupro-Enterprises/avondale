import { createFileRoute } from '@tanstack/react-router'
import { History, ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SystemAdminHeader } from '@/components/layout/system-admin-header'
import { StatusBadge } from '@/components/status-badge'
import { ROLE_LABELS, type EduproRole } from '@/lib/frappe/roles'
import { useUsers } from '@/lib/frappe/users'
import { useAuditLog } from '@/lib/frappe/audit-log'

export const Route = createFileRoute('/_system-admin/system-admin/')({
  component: SystemAdminDashboard,
})

function SystemAdminDashboard() {
  const { data: users } = useUsers()
  const { data: auditLog } = useAuditLog()

  const activeUsers = (users ?? []).filter((u) => u.enabled).length

  return (
    <>
      <SystemAdminHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>System Admin Dashboard</h1>
        </div>

        <div className='mb-6 grid gap-4 sm:grid-cols-2'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>Active users</CardTitle>
              <UsersIcon className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{activeUsers} <span className='text-sm font-normal text-muted-foreground'>/ {(users ?? []).length}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>Audit events logged</CardTitle>
              <History className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{(auditLog ?? []).length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'><ShieldCheck className='h-4 w-4' />Recent user activity</CardTitle>
          </CardHeader>
          <CardContent className='pt-0'>
            <div className='divide-y'>
              {(users ?? []).slice(0, 5).map((u) => (
                <div key={u.name} className='flex items-center justify-between py-3'>
                  <div>
                    <p className='text-sm font-medium'>{u.full_name}</p>
                    <p className='text-xs text-muted-foreground'>{u.roles.map((r) => ROLE_LABELS[r as EduproRole] ?? r).join(', ') || '—'} · last login {u.last_login || 'never'}</p>
                  </div>
                  <StatusBadge tone={u.enabled ? 'good' : 'bad'}>{u.enabled ? 'Active' : 'Suspended'}</StatusBadge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
