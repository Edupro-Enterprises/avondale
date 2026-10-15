import { expect, test } from '@playwright/test'
import { loginAs, requireCreds } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

test.describe('Authentication', () => {
  for (const role of ROLES) {
    test(`${role.role} can sign in and lands on the right place`, async ({ page }) => {
      const { otpShown } = await loginAs(page, role)
      await test.info().attach(`${role.role}-post-login`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      test.info().annotations.push({
        type: 'otp-reachable',
        description: otpShown ? 'yes -- 2FA challenge appeared' : 'no -- DEF-QA3-002 (2FA disabled site-wide)',
      })
    })
  }

  test('wrong password shows an error, not a silent failure', async ({ page }) => {
    const creds = requireCreds('BURSAR')
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(creds.email)
    await page.getByLabel('Password').fill('definitely-not-the-real-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/incorrect email or password/i)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('empty email/password shows inline validation, not a network call', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/please enter your email/i)).toBeVisible()
    await expect(page.getByText(/please enter your password/i)).toBeVisible()
  })

  test('visual reference: every auth screen', async ({ page }) => {
    for (const path of ['/sign-in', '/sign-up', '/forgot-password', '/otp']) {
      await page.goto(path)
      await test.info().attach(`auth-screen-${path.replace(/\//g, '') || 'root'}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    }
  })

  test('the /otp route is disconnected template code, not the real 2FA flow', async ({ page }) => {
    // See README's "Known limitations" -- src/features/auth/otp/components/otp-form.tsx's
    // onSubmit calls showSubmittedData() (a mock helper) and navigates to "/" after a
    // fixed timeout, with no call to submitTwoFactorOtp. This test documents that fact
    // rather than treating it as a real login step.
    await page.goto('/otp')
    await expect(page.getByRole('textbox', { name: 'One-Time Password' })).toBeVisible()
    // No assertion on where submitting it goes -- it's not wired to auth.ts at all,
    // so any behavior it has is incidental, not a contract worth locking in.
  })
})
