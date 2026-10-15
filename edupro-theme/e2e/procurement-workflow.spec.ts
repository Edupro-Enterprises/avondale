import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!
const SDC = ROLES.find((r) => r.envKey === 'SDC')!
const SCHOOL_HEAD = ROLES.find((r) => r.envKey === 'SCHOOL_HEAD')!

const TEST_DOC = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

/** Fund B so the full 3-actor chain (Bursar -> SDC co-approve -> School
 * Head final approve) actually runs -- a Fund A voucher auto-routes
 * straight past SDC (see payment_voucher.py's validate()), which would
 * only exercise 2 of the 3 approval steps. */
test.describe.serial('Requisition -> Quotation -> PO -> Payment Voucher, full approval chain (item 7)', () => {
  const purpose = `QA-E2E-DELETE-ME-${Date.now()}`
  let poName: string | undefined
  let voucherName: string | undefined

  test('Bursar: create requisition, add quotations until PRAZ requirement is met, issue PO', async ({ page }) => {
    await loginAs(page, BURSAR)
    await page.goto('/bursar/procurement/requisitions')

    await page.getByRole('button', { name: 'New requisition' }).click()
    await page.getByLabel('Fund').click()
    await page.getByRole('option', { name: /Fund B/ }).click()
    await page.getByLabel('Budget line').click()
    // Budget lines under a Closed vote book are real, valid options in this
    // dropdown but get correctly rejected by the backend on submit ("...is
    // not Active -- requisitions cannot be raised against it") -- picking
    // blindly by position hit exactly that on a real run. Target the known
    // Fund B line under the Active "QA Readiness 2026" vote book instead
    // (created for this test plan -- see QA-VOTE-SDC-01 in the backend).
    const budgetLine = page.getByRole('option', { name: 'QA-VOTE-SDC-01' })
    if ((await budgetLine.count()) === 0) {
      test.skip(true, 'Fund B budget line QA-VOTE-SDC-01 (under the Active "QA Readiness 2026" vote book) not found on production.')
    }
    await budgetLine.click()
    await page.getByLabel('Purpose').fill(purpose)
    await page.locator('input[placeholder="Description"]').fill('QA e2e test item')
    await page.locator('input[placeholder="Qty"]').fill('1')
    await page.locator('input[placeholder="Unit cost"]').fill('10')
    await page.getByRole('button', { name: 'Create' }).click()
    // The dialog closing is the reliable success signal -- the toast text
    // alone is timing-sensitive (sonner auto-dismisses) and was flaky here.
    await expect(page.getByRole('dialog', { name: 'New requisition' })).not.toBeVisible({ timeout: 10_000 })

    await page.getByText(purpose).first().click()
    await expect(page.getByRole('heading', { name: purpose })).toBeVisible()

    const requiredMatch = await page.getByText(/of \d+ required/).textContent()
    const required = Number(requiredMatch?.match(/of (\d+) required/)?.[1] ?? 1)

    // The Vendor <Select> here has no <Label> (just a placeholder), unlike
    // the main dialog's Fund/Budget line fields -- getByLabel() never
    // matches it, found on a real run. Locate it structurally (first button
    // in the "Add a quotation" section) rather than by its placeholder text,
    // since that text disappears once a vendor is selected.
    const vendorTrigger = page.getByText('Add a quotation').locator('xpath=..').locator('button').first()
    const vendorOptions = await vendorTrigger.click().then(() =>
      page.getByRole('option').allTextContents()
    )
    await page.keyboard.press('Escape')
    if (vendorOptions.length < required) {
      test.skip(true, `Requisition needs ${required} distinct quotations but only ${vendorOptions.length} vendor(s) exist on production -- add more Vendors first.`)
    }

    for (let i = 0; i < required; i++) {
      await vendorTrigger.click()
      await page.getByRole('option').nth(i).click()
      await page.locator('input[placeholder="Quoted amount"]').fill(String(10 + i))
      await page.locator('input[type="file"]').setInputFiles({ name: `quote-${i}.png`, mimeType: 'image/png', buffer: TEST_DOC })
      // The toast text "Quotation document attached" contains the button's
      // own post-upload label "Document attached" as a substring -- matches
      // both, strict-mode violation on a real run. Check the button itself
      // (exact match), which is what actually confirms the upload landed.
      await expect(page.getByRole('button', { name: 'Document attached', exact: true })).toBeVisible({ timeout: 10_000 })
      if (i === required - 1) {
        await page.getByLabel('Mark selected').check()
      }
      await page.getByRole('button', { name: 'Add quotation' }).click()
      // Consecutive quick adds can leave more than one un-dismissed toast
      // stacked at once -- match any of them, not a single exact element.
      await expect(page.getByText('Quotation added').first()).toBeVisible({ timeout: 10_000 })
      // addQuotation() builds its request from the CURRENT React Query
      // cache of this requisition's quotations -- moving to the next vendor
      // before that cache refetches means the next save overwrites instead
      // of appending (found live: 3 successful "Quotation added" toasts,
      // only 2 quotations ever persisted). Wait for the on-screen count to
      // actually reflect this addition before looping again.
      await expect(page.getByText(`(${i + 1} of ${required} required)`)).toBeVisible({ timeout: 10_000 })
    }

    // The button stays disabled until the requisition detail query refetches
    // with the 3rd quotation's data -- give that a moment rather than
    // clicking immediately (found timing out on a real run).
    await expect(page.getByRole('button', { name: 'Issue Purchase Order' })).toBeEnabled({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Issue Purchase Order' }).click()
    await expect(page.getByText(/ issued$/)).toBeVisible({ timeout: 10_000 })
    const issuedText = await page.getByText(/ issued$/).textContent()
    poName = issuedText?.match(/^(\S+) issued$/)?.[1]
    expect(poName, 'could not read the issued PO number off the page').toBeTruthy()
  })

  test('Bursar: create and submit a Payment Voucher for that PO', async ({ page }) => {
    test.skip(!poName, 'previous step did not produce a PO')
    await loginAs(page, BURSAR)
    await page.goto('/bursar/procurement/payment-vouchers')

    await page.getByRole('button', { name: 'New voucher' }).click()
    await page.getByLabel('Purchase Order', { exact: false }).click()
    await page.getByRole('option', { name: new RegExp(poName!) }).click()
    await page.getByLabel('Payment method', { exact: false }).click()
    await page.getByRole('option').first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('dialog', { name: 'Create a payment voucher' })).not.toBeVisible({ timeout: 10_000 })

    await page.getByText(new RegExp(poName!)).first().click()
    // getByRole('heading').first() risked grabbing the page's own <h1>
    // ("Payment Vouchers") rather than the detail dialog's own title (the
    // voucher's name) -- Radix Dialogs portal to the end of <body>, so DOM
    // order doesn't put the dialog's heading first. Scope to the dialog.
    voucherName = (await page.getByRole('dialog').getByRole('heading').first().textContent()) ?? undefined

    await page.getByRole('button', { name: /submit for approval/i }).click()
    await expect(page.getByText(/pending sdc co-approval/i)).toBeVisible({ timeout: 10_000 })
  })

  test('SDC: co-approves the Fund B voucher', async ({ page }) => {
    test.skip(!voucherName, 'previous step did not produce a submitted voucher')
    await loginAs(page, SDC)
    await page.goto('/sdc/payment-vouchers')
    await page.getByText(voucherName!).first().click()
    await page.getByRole('button', { name: 'Co-approve' }).click()
    await expect(page.getByText(/co-approved, sent to school head/i)).toBeVisible({ timeout: 10_000 })
  })

  test('School Head: gives final approval', async ({ page }) => {
    test.skip(!voucherName, 'previous step did not produce a co-approved voucher')
    await loginAs(page, SCHOOL_HEAD)
    await page.goto('/school-head/payment-vouchers')
    await page.getByText(voucherName!).first().click()
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText(/approved and cleared for disbursement/i)).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async ({ browser }) => {
    // Best-effort cleanup, in reverse dependency order (Payment Voucher ->
    // Purchase Order -> Requisition) -- this spec had no cleanup at all
    // before, unlike students-crud.spec.ts, and left REQ-2026-0000[4-8]
    // behind across several runs while this file was being tightened up.
    const page = await (await browser.newContext()).newPage()
    await loginAs(page, BURSAR)
    const csrf = (await page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token)) ?? ''
    const headers = { 'X-Frappe-CSRF-Token': csrf }

    if (voucherName) {
      await page.request.delete(`/api/resource/Payment Voucher/${encodeURIComponent(voucherName)}`, { headers }).catch(() => {})
    }
    if (poName) {
      await page.request.delete(`/api/resource/Purchase Order/${encodeURIComponent(poName)}`, { headers }).catch(() => {})
    }
    const reqRes = await page.request.get('/api/resource/Requisition', {
      params: { filters: JSON.stringify([['purpose', '=', purpose]]), fields: JSON.stringify(['name']) },
    })
    for (const req of (await reqRes.json())?.data ?? []) {
      await page.request.delete(`/api/resource/Requisition/${encodeURIComponent(req.name)}`, { headers }).catch(() => {})
    }
  })
})
