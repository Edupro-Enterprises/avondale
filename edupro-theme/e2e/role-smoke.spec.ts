import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

test.describe('Per-role smoke test (item 9 + item 10)', () => {
  for (const role of ROLES.filter((r) => r.home)) {
    test.describe(role.role, () => {
      test.beforeEach(async ({ page }) => {
        await loginAs(page, role)
      })

      for (const item of role.nav) {
        test(`"${item.label}" (${item.path}) renders without error`, async ({ page }) => {
          const consoleErrors: string[] = []
          page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text())
          })
          page.on('pageerror', (err) => consoleErrors.push(err.message))

          const response = await page.goto(item.path)
          await page.waitForLoadState('networkidle')

          expect(response?.ok() ?? true, `${item.path} returned HTTP ${response?.status()}`).toBe(true)
          // Not-found route (TanStack Router's catch-all) renders a
          // "404"/"not found"-ish page instead of an HTTP error -- catch
          // that too, plus the app's own error boundary text.
          await expect(page.getByText(/page not found|something went wrong|unexpected error/i)).toHaveCount(0)
          await expect(page).not.toHaveURL(/\/sign-in/) // silently bounced back = broken auth/permission for this role

          if (consoleErrors.length > 0) {
            test.info().annotations.push({
              type: 'console-errors',
              description: consoleErrors.slice(0, 5).join(' | '),
            })
          }
        })
      }
    })
  }

  for (const role of ROLES.filter((r) => !r.home)) {
    test(`${role.role} has no dashboard shell yet -- login lands back on /sign-in`, async ({ page }) => {
      await loginAs(page, role) // asserts the /sign-in landing itself
      test.info().annotations.push({
        type: 'no-shell',
        description: `${role.role} is a real backend role (confirmed DocPerm rows exist) with no frontend shell built -- out of scope for this app today, not a bug.`,
      })
    })
  }
})
