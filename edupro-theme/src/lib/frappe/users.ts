/** Frappe's own native User + "Has Role" doctypes -- not a custom
 * edupro_school_fees doctype. "Has Role" is the child table backing
 * User.roles; listing it directly (filtered to parenttype=User) gets every
 * user's role assignments in one call instead of N role lookups. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import type { EduproRole } from './roles'

export interface FrappeUser {
  name: string // the user's email -- Frappe uses it as the doc id
  full_name: string
  enabled: 0 | 1
  last_login?: string
  creation: string
}

const USER_FIELDS = ['name', 'full_name', 'enabled', 'last_login', 'creation']

interface HasRoleRow {
  parent: string
  role: string
}

export function useUsers() {
  return useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const [usersRes, rolesRes] = await Promise.all([
        listResource<FrappeUser>('User', {
          fields: JSON.stringify(USER_FIELDS),
          filters: JSON.stringify([['name', 'not in', ['Administrator', 'Guest']]]),
          order_by: 'full_name asc',
          limit_page_length: '0',
        }),
        listResource<HasRoleRow>('Has Role', {
          fields: JSON.stringify(['parent', 'role']),
          filters: JSON.stringify([['parenttype', '=', 'User']]),
          // Frappe requires the child table's parent DOCTYPE to list it
          // directly (frappe.model.db_query.check_parent_permission) --
          // without this the call 403s even for a System Manager.
          parent: 'User',
          limit_page_length: '0',
        }),
      ])
      const rolesByUser = new Map<string, string[]>()
      for (const row of rolesRes.data) {
        const list = rolesByUser.get(row.parent) ?? []
        list.push(row.role)
        rolesByUser.set(row.parent, list)
      }
      return usersRes.data.map((u) => ({ ...u, roles: rolesByUser.get(u.name) ?? [] }))
    },
  })
}

export interface NewUserInput {
  email: string
  full_name: string
  role: EduproRole
  new_password?: string
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, full_name, role, new_password }: NewUserInput) => {
      const [first_name, ...rest] = full_name.trim().split(' ')
      await api.post('/api/resource/User', {
        email,
        first_name,
        last_name: rest.join(' ') || undefined,
        send_welcome_email: 0,
        roles: [{ role }],
        ...(new_password ? { new_password } : {}),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-users'] }),
  })
}

export function useSetUserEnabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: 0 | 1 }) => {
      await api.put(`/api/resource/User/${encodeURIComponent(name)}`, { enabled })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-users'] }),
  })
}

/** Replaces this user's entire role set with a single Edupro role -- matches
 * this screen's one-role-per-user model. A user holding extra roles outside
 * the 8 Edupro ones (rare -- e.g. a raw System Manager account) would lose
 * those on save; this page is for managing Edupro access, not general
 * Frappe administration. */
export function useResetUserPassword() {
  return useMutation({
    mutationFn: async ({ name, new_password }: { name: string; new_password: string }) => {
      await api.put(`/api/resource/User/${encodeURIComponent(name)}`, { new_password })
    },
  })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, role }: { name: string; role: EduproRole }) => {
      await api.put(`/api/resource/User/${encodeURIComponent(name)}`, { roles: [{ role }] })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-users'] }),
  })
}
