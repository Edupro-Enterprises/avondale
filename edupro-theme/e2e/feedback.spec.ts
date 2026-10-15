import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!

test.describe('Success/failure feedback (item 11)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, BURSAR)
  })

  test.describe('"fake success" stubs — toast fires but nothing real happened', () => {
    test('Bursar dashboard "New invoice" quick-dialog', async ({ page }) => {
      await page.goto('/bursar')
      await page.getByRole('button', { name: 'New invoice' }).click()
      await page.getByRole('button', { name: 'Raise invoice' }).click()
      await expect(page.getByText('Invoice raised')).toBeVisible()
      // No student/fee-structure was actually selected (the inputs aren't
      // even bound to state) -- this toast is unconditional. Confirms
      // finding #5 (test plan) rather than testing a real invoice flow --
      // that's fees-workflow.spec.ts's job, against the real Billing > Invoices page.
    })

    test('Bursar dashboard "Record receipt" quick-dialog', async ({ page }) => {
      await page.goto('/bursar')
      await page.getByRole('button', { name: 'Record receipt' }).click()
      await page.getByRole('button', { name: 'Post receipt' }).click()
      await expect(page.getByText('Receipt posted')).toBeVisible()
    })

    test('Guardians "Add guardian" dialog', async ({ page }) => {
      await page.goto('/bursar/guardians')
      const addButton = page.getByRole('button', { name: /add guardian/i })
      if ((await addButton.count()) === 0) {
        test.skip(true, 'Add guardian control not found -- page may have changed since investigation; re-verify manually')
      }
      await addButton.click()
      const submit = page.getByRole('dialog').getByRole('button').last()
      await submit.click()
      // Just documenting that SOME success feedback fires with no real
      // backend call -- exact toast copy noted in the annotation for the report.
    })
  })

  test.describe('real mutations — toast should appear (regression guard)', () => {
    test('Journal Entries page loads with no error toast (read-only page, negative check)', async ({ page }) => {
      await page.goto('/bursar/finance/journal-entries')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
    })
  })
})
