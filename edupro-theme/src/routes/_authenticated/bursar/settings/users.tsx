import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound, Plus, Users as UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { ROLE_LABELS, type EduproRole } from '@/lib/frappe/roles'
import {
  useUsers,
  useCreateUser,
  useSetUserEnabled,
  useSetUserRole,
  useResetUserPassword,
  type FrappeUser,
} from '@/lib/frappe/users'

export const Route = createFileRoute('/_authenticated/bursar/settings/users')({
  component: UsersPage,
})

type UserWithRoles = FrappeUser & { roles: string[] }

const ASSIGNABLE_ROLES: EduproRole[] = ['Bursar', 'School Head', 'SDC Chairperson/Treasurer', 'Fees Approver']

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'status', label: 'Status', options: ['Enabled', 'Disabled'] }]

function ResetPasswordDialog({ user }: { user: UserWithRoles }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const resetPassword = useResetUserPassword()

  async function submit() {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    try {
      await resetPassword.mutateAsync({ name: user.name, new_password: password })
      toast.success(`Password reset for ${user.full_name}`)
      setOpen(false)
      setPassword('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not reset this password.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon' aria-label={`Reset password for ${user.full_name}`}><KeyRound className='h-4 w-4' /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset password — {user.full_name}</DialogTitle></DialogHeader>
        <CompactField label='New password'>
          <Input className={compactControlClass} type='text' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='At least 6 characters' />
        </CompactField>
        <DialogFooter>
          <Button onClick={submit} disabled={resetPassword.isPending}>{resetPassword.isPending ? 'Saving…' : 'Reset password'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UsersPage() {
  const { data: users, isLoading, error } = useUsers()
  const createUser = useCreateUser()
  const setUserEnabled = useSetUserEnabled()
  const setUserRole = useSetUserRole()
  const filters = useFilters('settings-users', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<{ full_name: string; email: string; role: EduproRole; new_password: string }>({
    full_name: '', email: '', role: 'Bursar', new_password: '',
  })

  const filtered = useMemo(
    () =>
      (users ?? []).filter(
        (u) =>
          (u.full_name.toLowerCase().includes(filters.search.toLowerCase()) || u.name.toLowerCase().includes(filters.search.toLowerCase())) &&
          (!filters.values.status || (filters.values.status === 'Enabled' ? u.enabled === 1 : u.enabled !== 1))
      ),
    [users, filters.search, filters.values]
  )

  async function submitAdd() {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Name and email are required.')
      return
    }
    try {
      await createUser.mutateAsync({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        role: form.role,
        new_password: form.new_password.trim() || undefined,
      })
      toast.success(`${form.full_name} added`)
      setAddOpen(false)
      setForm({ full_name: '', email: '', role: 'Bursar', new_password: '' })
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this user.')
    }
  }

  async function toggleEnabled(user: UserWithRoles) {
    try {
      await setUserEnabled.mutateAsync({ name: user.name, enabled: user.enabled === 1 ? 0 : 1 })
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this user.')
    }
  }

  async function changeRole(user: UserWithRoles, role: EduproRole) {
    try {
      await setUserRole.mutateAsync({ name: user.name, role })
      toast.success(`Role updated for ${user.full_name}`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this role.')
    }
  }

  const columns: DataListColumn<UserWithRoles>[] = [
    {
      id: 'name',
      header: 'User',
      sortable: true,
      sortValue: (u) => u.full_name,
      className: 'min-w-48',
      cell: (u) => (
        <div className='flex flex-col'>
          <span className='truncate'>{u.full_name}</span>
          <span className='truncate text-xs text-muted-foreground'>{u.name}</span>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (u) => (
        <Select value={(u.roles.find((r) => ASSIGNABLE_ROLES.includes(r as EduproRole)) as EduproRole) ?? undefined} onValueChange={(v) => changeRole(u, v as EduproRole)}>
          <SelectTrigger className='w-52'><SelectValue placeholder='No role' /></SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (u) => u.enabled,
      cell: (u) => (
        <button onClick={() => toggleEnabled(u)} disabled={setUserEnabled.isPending}>
          <StatusBadge tone={u.enabled === 1 ? 'good' : 'neutral'}>{u.enabled === 1 ? 'Enabled' : 'Disabled'}</StatusBadge>
        </button>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (u) => <ResetPasswordDialog user={u} />,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Settings</p>
            <h1 className='text-3xl font-bold tracking-tight'>Users</h1>
            <p className='text-sm text-muted-foreground'>Manage who can sign in and what role they hold.</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a user</DialogTitle></DialogHeader>
              <div className='grid gap-3 py-2'>
                <CompactField label='Full name'>
                  <Input className={compactControlClass} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                </CompactField>
                <CompactField label='Email'>
                  <Input className={compactControlClass} type='email' value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </CompactField>
                <CompactField label='Role'>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as EduproRole }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Default password (optional)'>
                  <Input className={compactControlClass} value={form.new_password} onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))} placeholder='Leave blank to set later' />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submitAdd} disabled={createUser.isPending}>{createUser.isPending ? 'Adding…' : 'Add user'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load users from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>{filtered.length} of {users?.length ?? 0}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by name or email…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(u) => u.name}
              isLoading={isLoading}
              densityStorageKey='settings-users'
              emptyState={{
                icon: UsersIcon,
                title: 'No users found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Users will appear here once added.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
