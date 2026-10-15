import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, UserSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { SystemAdminHeader } from '@/components/layout/system-admin-header'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { ROLE_LABELS, type EduproRole } from '@/lib/frappe/roles'
import { useUsers, useCreateUser, useSetUserEnabled, useSetUserRole } from '@/lib/frappe/users'

export const Route = createFileRoute('/_system-admin/system-admin/users')({
  component: UsersPage,
})

type UserRow = ReturnType<typeof useUsers>['data'] extends (infer T)[] | undefined ? T : never

const ROLES = Object.keys(ROLE_LABELS) as EduproRole[]
const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'role', label: 'Role', options: ROLES.map((r) => ROLE_LABELS[r]) }]

function statusTone(enabled: 0 | 1): StatusTone {
  return enabled ? 'good' : 'bad'
}

function UsersPage() {
  const { data: users, isLoading, error } = useUsers()
  const createUser = useCreateUser()
  const setEnabled = useSetUserEnabled()
  const setRole = useSetUserRole()

  const filters = useFilters('system-users', FILTER_GROUPS)
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<EduproRole>('Parent/Guardian')

  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editRole, setEditRole] = useState<EduproRole>('Parent/Guardian')

  const rows = useMemo(() => users ?? [], [users])
  const filtered = useMemo(
    () =>
      rows.filter(
        (u) =>
          u.full_name.toLowerCase().includes(filters.search.toLowerCase()) &&
          (!filters.values.role || u.roles.some((r) => ROLE_LABELS[r as EduproRole] === filters.values.role))
      ),
    [rows, filters.search, filters.values]
  )

  function openEdit(u: UserRow) {
    setEditing(u)
    setEditRole((u.roles.find((r) => r in ROLE_LABELS) as EduproRole) ?? 'Parent/Guardian')
  }

  async function submitNewUser() {
    if (!newEmail.trim() || !newName.trim()) {
      toast.error('Name and email are required.')
      return
    }
    try {
      await createUser.mutateAsync({ email: newEmail.trim(), full_name: newName.trim(), role: newRole })
      toast.success('User created')
      setAddOpen(false)
      setNewEmail('')
      setNewName('')
      setNewRole('Parent/Guardian')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this user.')
    }
  }

  async function saveEdit() {
    if (!editing) return
    try {
      await setRole.mutateAsync({ name: editing.name, role: editRole })
      toast.success(`${editing.full_name}'s role updated`)
      setEditing(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this user.')
    }
  }

  async function toggleEnabled(u: UserRow) {
    try {
      await setEnabled.mutateAsync({ name: u.name, enabled: u.enabled ? 0 : 1 })
      toast.success(u.enabled ? `${u.full_name} suspended` : `${u.full_name} reactivated`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this user.')
    }
  }

  const columns: DataListColumn<UserRow>[] = [
    {
      id: 'name',
      header: 'User',
      sortable: true,
      sortValue: (u) => u.full_name,
      className: 'min-w-40',
      cell: (u) => (
        <div className='flex flex-col'>
          <span className='truncate'>{u.full_name}</span>
          <span className='truncate text-xs text-muted-foreground'>{u.name}</span>
        </div>
      ),
    },
    { id: 'role', header: 'Role', cell: (u) => u.roles.map((r) => ROLE_LABELS[r as EduproRole] ?? r).join(', ') || '—' },
    { id: 'lastLogin', header: 'Last Login', sortable: true, sortValue: (u) => u.last_login ?? '', cell: (u) => u.last_login || 'never' },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (u) => u.enabled,
      cell: (u) => <StatusBadge tone={statusTone(u.enabled)}>{u.enabled ? 'Active' : 'Suspended'}</StatusBadge>,
    },
  ]

  return (
    <>
      <SystemAdminHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Access Control</p>
            <h1 className='text-3xl font-bold tracking-tight'>Users</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a user</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Name' className='col-span-2'>
                  <Input className={compactControlClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='Full name' />
                </CompactField>
                <CompactField label='Email' className='col-span-2'>
                  <Input type='email' className={compactControlClass} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder='name@example.com' />
                </CompactField>
                <CompactField label='Role' className='col-span-2'>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as EduproRole)}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submitNewUser} disabled={createUser.isPending}>{createUser.isPending ? 'Creating…' : 'Create user'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load users from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All users</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by name…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(u) => u.name}
              isLoading={isLoading}
              onRowClick={openEdit}
              densityStorageKey='system-users'
              emptyState={{
                icon: UserSearch,
                title: 'No users found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Users will appear here once created.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.full_name}</DialogTitle>
              <DialogDescription>{editing?.name}</DialogDescription>
            </DialogHeader>
            <div className='grid grid-cols-2 gap-3 py-2'>
              <CompactField label='Role' className='col-span-2'>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as EduproRole)}>
                  <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select>
              </CompactField>
            </div>
            <DialogFooter className='gap-2 sm:gap-2'>
              <Button
                variant='outline'
                disabled={setEnabled.isPending}
                onClick={() => editing && toggleEnabled(editing)}
              >
                {editing?.enabled ? 'Suspend' : 'Reactivate'}
              </Button>
              <Button onClick={saveEdit} disabled={setRole.isPending}>{setRole.isPending ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
