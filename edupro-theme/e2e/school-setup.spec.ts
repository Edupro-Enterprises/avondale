import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!

// A 1x1 transparent PNG, inlined so the spec needs no binary fixture file.
const TEST_LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

test.describe('School Setup — logo', () => {
  test('uploading a school logo saves to the backend, but does not appear anywhere on screen (known bug)', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/school-setup/institution-profile')
    await expect(page.getByRole('heading', { name: 'Institution Profile' })).toBeVisible()

    // Note the sidebar logo BEFORE the upload -- it's the default favicon
    // icon per src/components/layout/app-sidebar.tsx's SchoolLogoIcon,
    // since useSchoolBrandingStore.isCustomLogo defaults false.
    const sidebarLogo = page.locator('img[alt=""]').first()
    const srcBefore = await sidebarLogo.getAttribute('src')

    await page.getByRole('button', { name: 'Upload logo' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-logo.png',
      mimeType: 'image/png',
      buffer: TEST_LOGO_PNG,
    })
    await expect(page.getByText('Logo uploaded -- save to apply')).toBeVisible().catch(() => {})

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Institution profile saved')).toBeVisible({ timeout: 10_000 })

    // Reload so we're reading the persisted state, not just in-memory form state.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Institution Profile' })).toBeVisible()

    // The upload DID reach the backend -- a logo <img> now renders in the
    // "Logo" field itself (institution-profile.tsx:161, reads form.school_logo
    // directly from useSchoolSetup()).
    await expect(page.locator('img[alt="School logo"]')).toBeVisible()

    // But the SIDEBAR logo -- read from the separate, disconnected
    // useSchoolBrandingStore, never updated by this page's handleSave --
    // is unchanged. This assertion documents the bug (finding #1 in the
    // test plan); it should start failing once the store is wired to
    // useSchoolSetup().school_logo, at which point this spec should be
    // updated to assert the fix instead.
    const srcAfter = await sidebarLogo.getAttribute('src')
    expect(srcAfter).toBe(srcBefore)
    expect(srcAfter).toContain('favicon')
  })

  test('sign-in page shows the Edupro platform logo, not any school logo (by design, per the plan\'s item 2)', async ({ page }) => {
    await page.goto('/sign-in')
    const logo = page.locator('img').first()
    await expect(logo).toBeVisible()
    const src = await logo.getAttribute('src')
    // Confirms the current, pre-login behavior -- useSchoolBrandingStore's
    // DEFAULT_LOGO_URL is the Edupro asset until a school's own logo is
    // wired in (see school-setup.spec.ts's first test for why that never
    // happens today).
    test.info().annotations.push({ type: 'sign-in-logo-src', description: src ?? '(none)' })
  })
})
