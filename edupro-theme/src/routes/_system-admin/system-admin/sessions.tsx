import { createFileRoute } from '@tanstack/react-router'
import { Monitor } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SystemAdminHeader } from '@/components/layout/system-admin-header'
import { StatusBadge } from '@/components/status-badge'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useRecentSignIns, type FrappeAuditLogEntry } from '@/lib/frappe/audit-log'

export const Route = createFileRoute('/_system-admin/system-admin/sessions')({
  component: SessionsPage,
})

const columns: DataListColumn<FrappeAuditLogEntry>[] = [
  {
    id: 'user',
    header: 'User',
    sortable: true,
    sortValue: (s) => s.user,
    className: 'min-w-40',
    cell: (s) => (
      <div className='flex flex-col'>
        <span className='truncate'>{s.user}</span>
        <span className='truncate text-xs text-muted-foreground'>signed in {s.timestamp}</span>
      </div>
    ),
  },
  { id: 'role', header: 'Role', sortable: true, sortValue: (s) => s.role ?? '', cell: (s) => <StatusBadge tone='neutral'>{s.role || '—'}</StatusBadge> },
]

function SessionsPage() {
  const { data: signIns, isLoading, error } = useRecentSignIns()

  return (
    <>
      <SystemAdminHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Access Control</p>
          <h1 className='text-3xl font-bold tracking-tight'>Sessions</h1>
          <p className='text-sm text-muted-foreground'>
            Frappe does not expose a live list of active sessions — this shows recent sign-ins from the audit trail instead.
          </p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load sign-in history from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Recent sign-ins</CardTitle>
            <CardDescription>{(signIns ?? []).length} most recent</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={signIns ?? []}
              columns={columns}
              getRowId={(s) => s.name}
              isLoading={isLoading}
              densityStorageKey='recent-sign-ins'
              emptyState={{ icon: Monitor, title: 'No sign-ins recorded', description: 'Sign-ins will appear here as people log in.' }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
