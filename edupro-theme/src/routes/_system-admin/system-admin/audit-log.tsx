import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { History, Lock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { SystemAdminHeader } from '@/components/layout/system-admin-header'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FilterBar } from '@/components/filter-bar'
import { useAuditLog, type FrappeAuditLogEntry } from '@/lib/frappe/audit-log'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'

export const Route = createFileRoute('/_system-admin/system-admin/audit-log')({
  component: AuditLogPage,
})

const FILTER_GROUPS: FilterGroupDef[] = []

const columns: DataListColumn<FrappeAuditLogEntry>[] = [
  { id: 'user', header: 'Actor', sortable: true, sortValue: (e) => e.user, className: 'min-w-32', cell: (e) => e.user },
  {
    id: 'action',
    header: 'Action',
    className: 'min-w-64',
    cell: (e) => (
      <div className='flex flex-col'>
        <span className='truncate'>{e.action}</span>
        {e.reference_name && <span className='truncate text-xs text-muted-foreground'>{e.reference_doctype} {e.reference_name}</span>}
      </div>
    ),
  },
  { id: 'timestamp', header: 'Timestamp', sortable: true, sortValue: (e) => e.timestamp, cell: (e) => e.timestamp },
]

function AuditLogPage() {
  const { data: entries, isLoading, error } = useAuditLog()
  const filters = useFilters('audit-log', FILTER_GROUPS)

  const rows = useMemo(() => entries ?? [], [entries])
  const filtered = useMemo(
    () =>
      rows.filter(
        (e) =>
          e.user.toLowerCase().includes(filters.search.toLowerCase()) ||
          e.action.toLowerCase().includes(filters.search.toLowerCase())
      ),
    [rows, filters.search]
  )

  return (
    <>
      <SystemAdminHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Audit</p>
          <h1 className='text-3xl font-bold tracking-tight'>Audit Log</h1>
          <p className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Lock className='h-3.5 w-3.5' />
            Read-only feed. Entries are immutable and cannot be edited or deleted, same as a Journal Entry.
          </p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load the audit log from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Event feed</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}, most recent first</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by actor or action…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(e) => e.name}
              isLoading={isLoading}
              densityStorageKey='audit-log'
              defaultSort={[{ id: 'timestamp', desc: true }]}
              emptyState={{
                icon: History,
                title: 'No audit events found',
                description: filters.search ? 'Try a different search.' : 'Events post here automatically as the system is used.',
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
