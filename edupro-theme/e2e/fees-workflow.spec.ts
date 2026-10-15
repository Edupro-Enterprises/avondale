import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

const BURSAR = ROLES.find((r) => r.envKey === 'BURSAR')!
const SCHOOL_HEAD = ROLES.find((r) => r.envKey === 'SCHOOL_HEAD')!
const PARENT = ROLES.find((r) => r.envKey === 'PARENT')!

async function csrfToken(page: import('@playwright/test').Page) {
  return (await page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token)) ?? ''
}

test.describe('Fee structure -> invoice -> receipt -> balance (item 5)', () => {
  test('generating an invoice has no working UI -- the real mechanism (run_batch_invoicing) is only reachable via direct API', async ({ page }) => {
    await loginAs(page, BURSAR)

    // Confirms the finding: Billing > Invoices has no "create" control at
    // all (read-only detail dialog on row click only), and Billing >
    // Batch Invoicing is still on mock data (mockStudents/mockFeeStructures),
    // not wired to the backend's real whitelisted run_batch_invoicing method
    // (edupro_school_fees.edupro_school_fees.doctype.invoice.invoice.run_batch_invoicing).
    await page.goto('/bursar/billing/invoices')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /new invoice|create invoice|generate/i })).toHaveCount(0)
  })

  test('the real invoicing mechanism works when called directly, and a receipt against it updates balance everywhere', async ({ page }) => {
    await loginAs(page, BURSAR)

    // 1. Find an Approved Fee Structure to invoice against.
    const fsRes = await page.request.get('/api/resource/Fee Structure', {
      params: { filters: JSON.stringify([['workflow_state', '=', 'Approved']]), fields: JSON.stringify(['name']), limit_page_length: '1' },
    })
    const fsData = await fsRes.json()
    const feeStructure = fsData?.data?.[0]?.name
    if (!feeStructure) {
      test.skip(true, 'No Approved Fee Structure exists on production to invoice against -- create one manually first, or note this gap in the report.')
    }

    // 2. Run the real backend batch-invoicing method directly (the UI path is broken -- see the test above).
    const runRes = await page.request.post(
      `/api/method/edupro_school_fees.edupro_school_fees.doctype.invoice.invoice.run_batch_invoicing`,
      { headers: { 'X-Frappe-CSRF-Token': await csrfToken(page) }, form: { fee_structure: feeStructure } }
    )
    expect(runRes.ok(), `run_batch_invoicing failed: ${await runRes.text()}`).toBe(true)

    // 3. Find student.demo's resulting outstanding invoice.
    const studentRes = await page.request.get('/api/resource/Student', {
      params: { filters: JSON.stringify([['user', '=', 'student.demo@edupro.co.zw']]), fields: JSON.stringify(['name']), limit_page_length: '1' },
    })
    const studentId = (await studentRes.json())?.data?.[0]?.name
    if (!studentId) {
      test.skip(true, 'student.demo is not linked to a Student record -- see the test plan\'s "Test accounts available" section.')
    }

    const invRes = await page.request.get('/api/resource/Invoice', {
      params: {
        filters: JSON.stringify([['student', '=', studentId], ['outstanding_amount', '>', 0], ['docstatus', '=', 1]]),
        fields: JSON.stringify(['name', 'outstanding_amount']),
        limit_page_length: '1',
      },
    })
    const invoice = (await invRes.json())?.data?.[0]
    if (!invoice) {
      test.skip(true, 'No outstanding invoice for student.demo after run_batch_invoicing -- may already be fully paid; re-run with a fresh Fee Structure.')
    }

    // 4. Record a receipt for the FULL outstanding amount through the real UI (this part does work).
    await page.goto('/bursar/cash-office/receipts')
    await page.getByRole('button', { name: 'Issue receipt' }).click()
    await page.getByLabel('Student').click()
    await page.getByRole('option', { name: 'Demo Student' }).click()
    await page.getByLabel('Invoice').click()
    await page.getByRole('option', { name: new RegExp(invoice.name) }).click()
    await page.getByLabel('Payment method').click()
    await page.getByRole('option').first().click()
    await page.getByRole('button', { name: 'Post receipt' }).click()
    await expect(page.getByText(/recorded and posted$/)).toBeVisible({ timeout: 10_000 })

    // 5. Cross-check the balance updated everywhere that shows it.
    await page.goto('/bursar/students')
    await page.getByPlaceholder(/search by name or id/i).fill('Demo Student')
    await expect(page.getByText('Settled').or(page.getByText(/\$0\.00/))).toBeVisible({ timeout: 10_000 })

    await loginAs(page, SCHOOL_HEAD)
    await page.goto('/school-head/students')
    await page.getByPlaceholder(/search/i).fill('Demo Student')
    await expect(page.getByText('Settled').or(page.getByText(/\$0\.00/))).toBeVisible({ timeout: 10_000 })

    await loginAs(page, PARENT)
    await page.goto('/portal')
    await expect(page.getByText(/\$0\.00/)).toBeVisible({ timeout: 10_000 })
  })
})
