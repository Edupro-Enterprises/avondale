import { expect, type Page, test } from '@playwright/test'
import { credsFor, type RoleFixture } from './roles'

/** Skips the current test with a clear reason instead of failing it when
 * E2E_<KEY>_EMAIL/PASSWORD aren't set in e2e/.env.test -- lets the suite
 * run incrementally as credentials are added, per e2e/README.md. */
export function requireCreds(envKey: string) {
  const creds = credsFor(envKey)
  if (!creds) {
    test.skip(true, `E2E_${envKey}_EMAIL / E2E_${envKey}_PASSWORD not set -- see e2e/.env.test.example`)
  }
  return creds!
}

async function attemptLogin(page: Page, role: RoleFixture, creds: { email: string; password: string }): Promise<{ otpShown: boolean }> {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(creds.email)
  await page.getByLabel('Password').fill(creds.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  const otpInput = page.getByPlaceholder('123456')
  const otpShown = await otpInput.isVisible({ timeout: 3000 }).catch(() => false)

  if (otpShown) {
    const otp = process.env[`E2E_${role.envKey}_OTP`]
    if (!otp) {
      throw new Error(
        `${role.role} triggered a 2FA challenge but no E2E_${role.envKey}_OTP is set. ` +
          `2FA is normally disabled site-wide (DEF-QA3-002) -- if you see this, it's been re-enabled; ` +
          `supply the emailed code via that env var to continue, or note this in the report.`
      )
    }
    await otpInput.fill(otp)
    await page.getByRole('button', { name: 'Verify' }).click()
  }

  if (role.home) {
    await expect(page).toHaveURL(new RegExp(`${role.home}(/|$)`), { timeout: 10_000 })
  } else {
    // Fees Approver / District Auditor have no shell yet -- login should
    // resolve but land back on sign-in (see ROLE_HOME's null entries).
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 })
  }

  return { otpShown }
}

/** Fills and submits the real sign-in form (src/features/auth/sign-in).
 * Handles the 2FA challenge branch if Frappe ever returns one (see
 * lib/frappe/auth.ts -- disabled site-wide today per DEF-QA3-002, but this
 * doesn't assume that stays true). Returns whether an OTP step was shown,
 * so auth.spec.ts can assert/report on it either way.
 *
 * Retries once on failure: a full suite run does many sequential logins
 * against the same handful of demo accounts, and a small fraction
 * intermittently land back on /sign-in with no visible error rather than
 * the expected redirect -- observed live, not yet root-caused (worth a
 * closer look at Frappe's login rate-limiting/attempt tracker if it keeps
 * happening). One retry is a pragmatic guard so a single flaky login
 * doesn't sink an otherwise-passing spec; a second consecutive failure is
 * treated as real and surfaces normally. */
export async function loginAs(page: Page, role: RoleFixture): Promise<{ otpShown: boolean }> {
  const creds = requireCreds(role.envKey)
  try {
    return await attemptLogin(page, role, creds)
  } catch (err) {
    test.info().annotations.push({
      type: 'login-retry',
      description: `First login attempt for ${role.role} failed (${(err as Error).message.split('\n')[0]}) -- retrying once.`,
    })
    return await attemptLogin(page, role, creds)
  }
}
