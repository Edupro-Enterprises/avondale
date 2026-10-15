import { expect, type Page, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!

/** CompactField's own <label> has no htmlFor (see components/compact-field.tsx),
 * so getByLabel() doesn't work on these dense setup-style forms -- find the
 * input as a sibling of its label text instead. */
function compactField(page: Page, labelText: string) {
  return page.locator('label', { hasText: labelText }).locator('xpath=..').locator('input')
}

/** There is no direct "create student" flow in this app -- the Bursar
 * Students roster's own "Add student" button is a stub
 * (toast.info('Add student form coming soon')). The real, working path is
 * Admissions -> Applicants -> Accept -> set Beneficiary Category -> Enrol,
 * which calls the backend's whitelisted enrol_applicant method and creates
 * a real Student record. This spec exercises that real path end to end,
 * since it's the only one that actually works -- confirming/denying item 6
 * against reality, not against what a UI button merely claims to do. */
test.describe('Student CRUD + enrolment (item 6)', () => {
  test('applicant -> accept -> enrol -> appears in the roster, filterable', async ({ page }) => {
    await loginAs(page, BURSAR)

    const stamp = Date.now()
    const applicantName = `QA-E2E-DELETE-ME-${stamp}`

    await page.goto('/bursar/admissions/applicants')
    await page.getByRole('button', { name: 'New application' }).click()
    await page.getByPlaceholder('Rufaro Chiweshe').fill(applicantName)
    await page.locator('input[type="date"]').fill('2015-01-01')

    // Select order in the dialog: Gender(0, optional, skipped), Academic
    // year(1, required) -- pick whatever's first available.
    await page.locator('button', { hasText: 'Select…' }).nth(1).click()
    await page.getByRole('option').first().click()

    await page.getByPlaceholder('Form 1').fill('Form 1')
    await compactField(page, 'Guardian name').fill(applicantName)
    await page.getByPlaceholder('+263 77 …').fill('+263771234567')

    await page.getByRole('button', { name: 'Record application' }).click()
    await expect(page.getByText(`${applicantName} not found`)).toHaveCount(0) // sanity: no stray error text
    await expect(page.getByText(/recorded$/)).toBeVisible({ timeout: 10_000 })

    // Open the newly created applicant.
    await page.getByText(applicantName).first().click()
    await expect(page.getByRole('heading', { name: applicantName })).toBeVisible()

    await page.getByRole('button', { name: 'Decision' }).click()
    await page.getByRole('button', { name: 'Accept application' }).click()
    await expect(page.getByText('Current status').locator('..').getByText('Accepted')).toBeVisible({ timeout: 10_000 })

    // The beneficiary-category picker lives INSIDE the "Enrol as student"
    // dialog (not a standalone page element before it) -- open the dialog
    // first, then set the category, which is what enables the "Enrol" button.
    await page.getByRole('button', { name: 'Enrol as student' }).click()
    // getByRole('button', { name: 'Select…' }) (exact accessible-name match)
    // didn't match this trigger on a real run -- the looser hasText locator
    // (substring match) is the pattern that already works elsewhere in this
    // repo's Select-heavy dialogs (see the Academic year picker above).
    await page.getByRole('dialog').locator('button', { hasText: 'Select…' }).click()
    await page.getByRole('option').first().click()
    await page.getByRole('button', { name: 'Set' }).click()
    await expect(page.getByRole('button', { name: 'Enrol', exact: true })).toBeEnabled({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Enrol', exact: true }).click()
    await expect(page.getByText(/^Enrolled as /).first()).toBeVisible({ timeout: 10_000 })

    const enrolledText = await page.getByText(/^Enrolled as /).first().textContent()
    const studentId = enrolledText?.match(/Enrolled as (\S+)/)?.[1]
    expect(studentId, 'could not read the enrolled student id off the page').toBeTruthy()

    // Confirm the new student is real: shows up in the roster, findable by search.
    await page.goto('/bursar/students')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder(/search by name or id/i).fill(applicantName)
    await expect(page.getByText(applicantName)).toBeVisible({ timeout: 10_000 })

    // Clean-up: best-effort delete via the authenticated session's own
    // cookies (same as the app itself uses) -- Bursar may or may not have
    // delete rights on Student; either way this doesn't fail the test,
    // since the workflow itself is what's under test.
    if (studentId) {
      const res = await page.request.delete(`/api/resource/Student/${encodeURIComponent(studentId)}`, {
        headers: { 'X-Frappe-CSRF-Token': (await page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token)) ?? '' },
      })
      test.info().annotations.push({
        type: 'cleanup',
        description: res.ok()
          ? `deleted ${studentId}`
          : `could not delete ${studentId} (HTTP ${res.status()}) -- remove manually via the desk if needed`,
      })
    }
  })
})
