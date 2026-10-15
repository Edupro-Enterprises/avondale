import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!

/** Full inventory of Export/Download/Print controls found across the app
 * during test-plan investigation -- every one of them is a decorative
 * `toast.success(...)` with no real network call behind it (no PDF
 * library in this repo, no backend Print Format/get_pdf method exists).
 * This spec proves that, rather than assuming it, so the finding stays
 * accurate as the app changes. */
const EXPORT_BUTTONS: { path: string; button: string }[] = [
  { path: '/bursar/reports/cash-flow', button: 'Export' },
  { path: '/bursar/reports/bank-reconciliation', button: 'Export' },
  { path: '/bursar/reports/financial-position', button: 'Export' },
  { path: '/bursar/reports/ledger', button: 'Export' },
  { path: '/bursar/reports/fixed-assets-register', button: 'Export' },
  { path: '/bursar/reports/comprehensive-income', button: 'Export' },
  { path: '/bursar/reports/receipts-payments', button: 'Export' },
  { path: '/bursar/reports/variance', button: 'Export' },
  { path: '/bursar/billing/invoices', button: 'Export' },
  { path: '/bursar/students', button: 'Export' },
]

test.describe('Document downloads', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, BURSAR)
  })

  for (const { path, button } of EXPORT_BUTTONS) {
    test(`${path} — "${button}" does not produce a real file (documents finding #4)`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      let downloadFired = false
      page.once('download', () => {
        downloadFired = true
      })

      await page.getByRole('button', { name: button, exact: false }).first().click()

      // Give any real download a moment to start; the toast fires either way.
      await page.waitForTimeout(1500)
      expect(downloadFired, `${path}'s "${button}" button produced a real file download -- update this test and the report, this finding may be resolved`).toBe(false)
    })
  }

  test('a receipt has no print/download affordance at all today', async ({ page }) => {
    await page.goto('/bursar/cash-office/receipts')
    await page.waitForLoadState('networkidle')
    // Confirms the absence rather than asserting a specific control exists.
    await expect(page.getByRole('button', { name: /print|download|pdf/i })).toHaveCount(0)
  })
})
