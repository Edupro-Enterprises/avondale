import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { CURRENT_USER_QUERY_KEY, fetchCurrentUser } from './auth'
import { primaryRole, ROLE_HOME, type EduproRole } from './roles'

/** Like requireRole, but for shells any logged-in user can reach regardless
 * of role (e.g. the knowledge base) -- only checks that someone is signed
 * in, never bounces to a role home. */
export function requireAnyAuth() {
  return async ({
    context,
    location,
  }: {
    context: { queryClient: QueryClient }
    location: { href: string }
  }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: fetchCurrentUser,
    })

    if (!user) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
  }
}

/** Shared `beforeLoad` guard for every role shell's pathless layout route.
 * Not logged in -> bounce to sign-in, remembering where they were headed.
 * Logged in but this shell isn't their role -> bounce to their own home
 * instead of showing someone else's dashboard or a raw 403. A user with
 * only a role that has no shell yet (Fees Approver, District Auditor --
 * see roles.ts) also lands on sign-in, since there's nowhere else to send
 * them. */
export function requireRole(role: EduproRole) {
  return async ({
    context,
    location,
  }: {
    context: { queryClient: QueryClient }
    location: { href: string }
  }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: fetchCurrentUser,
    })

    if (!user) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }

    if (user.roles.includes(role)) return

    const theirRole = primaryRole(user.roles)
    const home = theirRole ? ROLE_HOME[theirRole] : null
    throw redirect({ to: home ?? '/sign-in' })
  }
}
