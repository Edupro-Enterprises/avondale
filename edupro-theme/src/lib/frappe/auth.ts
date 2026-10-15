import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, FrappeApiError } from './client'

export interface CurrentUser {
  name: string // Frappe's own user id (usually the email)
  full_name: string
  roles: string[]
}

export interface TwoFactorChallenge {
  tmp_id: string
  prompt?: string
}

export type LoginResult =
  { done: true } | { done: false; challenge: TwoFactorChallenge }

export const CURRENT_USER_QUERY_KEY = ['current-user'] as const

/** Privileged roles (Bursar/School Head/SDC/Fees Approver/District Auditor --
 * see the backend's patches/enable_mfa_for_privileged_roles.py) have 2FA
 * enforced on Role itself, so a correct usr/pwd doesn't finish the login --
 * Frappe's response carries `verification`/`tmp_id` instead of completing
 * the session, and a second call with the emailed OTP + that tmp_id is what
 * actually logs in. 2FA is currently disabled site-wide on production as a
 * temporary mitigation (see the backend's Round 3 QA report, DEF-QA3-002),
 * so today every login likely resolves `done: true` immediately -- but this
 * still has to handle the challenge branch correctly for when it's fixed. */
export async function login(usr: string, pwd: string): Promise<LoginResult> {
  const res = await api.post<{ verification?: unknown; tmp_id?: string }>(
    '/api/method/login',
    { usr, pwd }
  )
  if (res.tmp_id) {
    const verification = res.verification as { prompt?: string } | undefined
    return {
      done: false,
      challenge: { tmp_id: res.tmp_id, prompt: verification?.prompt },
    }
  }
  return { done: true }
}

export async function submitTwoFactorOtp(
  usr: string,
  otp: string,
  tmpId: string
): Promise<void> {
  await api.post('/api/method/login', { usr, otp, tmp_id: tmpId })
}

export async function logout(): Promise<void> {
  await api.post('/api/method/logout')
}

/** Completes a key-based password reset (the link emailed by
 * reset_password()). Frappe's own update_password returns a descriptive
 * message with a 410 status on an invalid/used/expired key rather than the
 * generic _server_messages format the rest of this app's error handling
 * expects, so this reads the response body directly instead of going
 * through the shared FrappeApiError path -- callers get the real reason
 * back, not a generic "Frappe API error: 410". A successful call also logs
 * the browser in server-side (Frappe's own login_as()), so the caller only
 * needs to refresh the current-user query afterward, not log in again. */
export async function updatePassword(newPassword: string, key: string): Promise<void> {
  const res = await fetch('/api/method/frappe.core.doctype.user.user.update_password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPassword, key }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new FrappeApiError(
      typeof body.message === 'string' ? body.message : `Frappe API error: ${res.status}`,
      res.status
    )
  }
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const me = await api.get<{ message: string }>(
      '/api/method/frappe.auth.get_logged_user'
    )
    if (!me.message || me.message === 'Guest') return null

    const details = await api.get<{ message: { full_name: string } }>(
      `/api/method/frappe.client.get_value?doctype=User&filters=${encodeURIComponent(JSON.stringify({ name: me.message }))}&fieldname=full_name`
    )

    // frappe.core.doctype.user.user.get_roles was removed by a framework
    // version bump -- edupro_school_fees.utils.get_my_roles wraps the
    // stable internal frappe.get_roles() instead of chasing core's moving
    // whitelisted-API surface (see its own comment for the incident).
    const rolesRes = await api.get<{ message: string[] }>(
      '/api/method/edupro_school_fees.utils.get_my_roles'
    )

    return {
      name: me.message,
      full_name: details.message?.full_name ?? me.message,
      roles: rolesRes.message ?? [],
    }
  } catch (err) {
    // Any Frappe API failure here means "can't confirm you're logged in" --
    // including a misconfigured/unreachable backend (e.g. no VITE_FRAPPE_URL
    // proxy locally), not just an explicit 401/403. Treating those the same
    // as "not logged in" fails closed into the sign-in redirect instead of
    // an uncaught error surfacing the generic 500 page. A non-Frappe error
    // (a real bug) still propagates.
    if (err instanceof FrappeApiError) {
      return null
    }
    throw err
  }
}

/** The single source of truth for "who is logged in" -- a TanStack Query
 * cache entry, not a Zustand store, since the actual session lives
 * server-side in Frappe's cookie; this just reflects it. Call
 * `refresh()` after login/logout to make every consumer re-check. */
export function useCurrentUser() {
  const queryClient = useQueryClient()
  const { data, error, isLoading } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    refetchOnWindowFocus: false,
    retry: false,
  })

  return {
    user: data ?? null,
    isLoading,
    error,
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY }),
  }
}
