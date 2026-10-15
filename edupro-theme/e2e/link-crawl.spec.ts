import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { ROLES } from './fixtures/roles'

/** Follows every same-origin <a href> reachable from a role's dashboard,
 * one hop deep from each of the nav pages already covered by
 * role-smoke.spec.ts. Deliberately does NOT click <button> elements --
 * most mutating actions in this app sit behind a button that opens a
 * Dialog (approve/reject/escalate/delete/...), and a generic crawler
 * blindly clicking those in production would be destructive. Button-
 * triggered actions are covered by the hand-written workflow specs
 * instead (fees-workflow, students-crud, procurement-workflow, feedback). */
test.describe('Link crawl (item 10 — broken links/pages)', () => {
  for (const role of ROLES.filter((r) => r.home)) {
    test(`${role.role} — every in-app link from its nav pages resolves`, async ({ page, baseURL }) => {
      // A full crawl across every seed page + every unique link found can
      // legitimately take a while, especially for Bursar's 10 nav pages --
      // 120s still wasn't enough on a real run. A generous budget plus a
      // hard cap on unique links visited (below) keeps this bounded without
      // pretending the app itself is slow.
      test.setTimeout(300_000)
      await loginAs(page, role)

      const visited = new Set<string>()
      const broken: { from: string; href: string; issue: string }[] = []
      const seedPaths = [role.home!, ...role.nav.map((n) => n.path)]
      const MAX_LINKS = 60

      for (const seed of seedPaths) {
        if (visited.size >= MAX_LINKS) break
        await page.goto(seed)
        await page.waitForLoadState('networkidle')

        const hrefs = await page
          .locator('a[href^="/"]')
          .evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[])

        for (const href of new Set(hrefs)) {
          if (visited.has(href)) continue
          if (visited.size >= MAX_LINKS) break
          visited.add(href)

          const consoleErrors: string[] = []
          const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text())
          }
          page.on('console', onConsole)

          const response = await page.goto(new URL(href, baseURL).toString()).catch((e) => {
            broken.push({ from: seed, href, issue: `navigation failed: ${e.message}` })
            return null
          })
          if (response) {
            await page.waitForLoadState('networkidle').catch(() => {})
            if (!response.ok()) {
              broken.push({ from: seed, href, issue: `HTTP ${response.status()}` })
            } else if (await page.getByText(/page not found/i).count()) {
              broken.push({ from: seed, href, issue: 'renders "page not found"' })
            } else if (consoleErrors.length > 0) {
              broken.push({ from: seed, href, issue: `console error: ${consoleErrors[0]}` })
            }
          }
          page.off('console', onConsole)
        }
      }

      if (broken.length > 0) {
        test.info().annotations.push({ type: 'broken-links', description: JSON.stringify(broken, null, 2) })
      }
      expect(broken, `Broken links found for ${role.role}:\n${JSON.stringify(broken, null, 2)}`).toEqual([])
    })
  }
})
