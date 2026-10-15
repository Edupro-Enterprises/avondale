import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!

test.describe('Currency', () => {
  test('Institution Profile itself says the base currency is ZiG, not USD', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/school-setup/institution-profile')

    // institution-profile.tsx:204-209 -- "Base currency" is a disabled
    // Select hardcoded to ZiG. Combined with the backend's
    // edupro_school_fees/utils.py: BASE_CURRENCY = "ZiG" (every GL/report
    // total is normalized into ZiG first), this directly contradicts
    // src/lib/currency.ts's own comment: "USD is the primary currency
    // shown everywhere." This test pins down the on-screen half of that
    // contradiction (finding #2 in the test plan).
    const baseCurrencyField = page.getByText('Base currency').locator('..')
    await expect(baseCurrencyField.getByText('ZiG')).toBeVisible()
  })

  test('the exchange rate on screen is a local admin-set number, not the backend Exchange Rate doctype', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/school-setup/institution-profile')
    await expect(page.getByRole('heading', { name: 'Institution Profile' })).toBeVisible({ timeout: 10_000 })

    const rateInput = page.locator('input[type="number"]').first()
    await expect(rateInput).toBeVisible()
    const before = await rateInput.inputValue()

    // Changing it here only writes to useExchangeRateStore (localStorage) --
    // never to the backend's Exchange Rate doctype. A fresh browser
    // context / another device would see a different, unsynced number.
    await rateInput.fill('99')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Institution Profile' })).toBeVisible()
    const afterReload = await page.locator('input[type="number"]').first().inputValue()

    // Confirms it persisted (to localStorage, per-browser) rather than the
    // backend -- a genuinely shared, server-side rate would show the same
    // regardless of which browser/device reads it, which this alone can't
    // prove or disprove from a single Playwright context. Documented as a
    // known architecture gap, not something this assertion alone confirms.
    expect(afterReload).toBe('99')
    test.info().annotations.push({
      type: 'exchange-rate-before',
      description: `before=${before}, after storing 99 and reloading=${afterReload} (localStorage-backed, not the backend Exchange Rate doctype)`,
    })
  })

  test('visual reference: <Money> rendering across representative pages', async ({ page }) => {
    await loginAs(page, BURSAR)
    for (const path of [
      '/bursar',
      '/bursar/students',
      '/bursar/billing/invoices',
      '/bursar/cash-office/receipts',
      '/bursar/finance/budget-vote-book',
    ]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await test.info().attach(`money-${path.replace(/\//g, '_')}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    }
  })
})
