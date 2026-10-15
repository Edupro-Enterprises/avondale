import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!
const SCHOOL_HEAD = ROLES.find((r) => r.envKey === 'SCHOOL_HEAD')!

test.describe('Search / filter coverage (item 8)', () => {
  test('Bursar Students roster — free-text search works', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/students')
    await page.waitForLoadState('networkidle')
    const rowsBefore = await page.locator('[role="row"], tr').count()

    const search = page.getByPlaceholder(/search by name or id/i)
    await search.fill('zzz-no-student-should-match-this-zzz')
    await page.waitForTimeout(400)
    await expect(page.getByText(/no students found/i)).toBeVisible()

    await search.fill('')
    await page.waitForTimeout(400)
    const rowsAfter = await page.locator('[role="row"], tr').count()
    expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore) // clearing search restores the roster
  })

  test('Bursar Students roster has no grade/term/year filter (known gap)', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/students')
    await page.waitForLoadState('networkidle')
    // Roster DOES show a grade column, but there's no way to filter by it --
    // documenting the gap explicitly rather than silently passing.
    for (const label of [/^grade$/i, /^term$/i, /^academic year$/i]) {
      await expect(page.getByRole('button', { name: label })).toHaveCount(0)
    }
  })

  test('School Head Fee Structures has no search/filter UI at all (known gap)', async ({ page }) => {
    await loginAs(page, SCHOOL_HEAD)
    await page.goto('/school-head/fee-structures')
    await page.waitForLoadState('networkidle')
    await expect(page.getByPlaceholder(/search/i)).toHaveCount(0)
  })

  test('Bursar Payment Plans list has no search/filter UI at all (known gap)', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/debtors/payment-plans')
    await page.waitForLoadState('networkidle')
    await expect(page.getByPlaceholder(/search/i)).toHaveCount(0)
  })
})
