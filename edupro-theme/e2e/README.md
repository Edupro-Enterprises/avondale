# End-to-end tests

Runs against **production** (`https://fees.edupro.co.zw`) — there's no
staging environment for this app. Uses the real `*.demo@edupro.co.zw` test
accounts already seeded there, one per role.

## One-time setup

1. `npm run test:e2e:install` — installs the Chromium binary Playwright drives.
2. `cp e2e/.env.test.example e2e/.env.test`
3. Fill in each account's password in `e2e/.env.test`. This file is
   gitignored and Claude never sees or types these values — only the test
   scripts read them via `process.env`.
   - The System Admin account (`system-admin.demo@edupro.co.zw`) was
     created for this test plan with no password set. Log into the Frappe
     desk as Administrator or another System Manager, open
     [its User record](https://fees.edupro.co.zw/app/user/system-admin.demo@edupro.co.zw),
     and either set "New Password" directly, or use the "Reset Password"
     action to email yourself a reset link.
4. Any account you leave blank is **skipped**, not failed — the suite runs
   incrementally as you add credentials (see `requireCreds` in
   `fixtures/auth.ts`).

## Running

```bash
npm run test:e2e          # headless, full suite
npm run test:e2e:ui       # interactive UI mode, great for a first run
npx playwright test e2e/auth.spec.ts   # a single spec
```

Every failure captures a screenshot, video, and trace automatically
(`playwright.config.ts`). Open a trace with:

```bash
npx playwright show-trace test-results/<failing-test>/trace.zip
```

Or browse the HTML report after a run:

```bash
npx playwright show-report
```

## What each spec covers

| Spec | Covers |
|---|---|
| `auth.spec.ts` | Login per role, correct redirect, wrong-password handling, 2FA/OTP path |
| `school-setup.spec.ts` | Institution Profile logo upload + where it does/doesn't appear |
| `currency.spec.ts` | On-screen `<Money>` rendering across representative pages |
| `documents.spec.ts` | Every Export/Download/Print control — does a real file download fire? |
| `fees-workflow.spec.ts` | Fee structure → invoice → receipt → balance update, cross-role |
| `students-crud.spec.ts` | Create/edit/enroll/clean-up a test student |
| `procurement-workflow.spec.ts` | Requisition → Quotation → PO → Payment Voucher → SDC → School Head |
| `search-filters.spec.ts` | Search boxes work; grade/term/year filter gaps are asserted explicitly |
| `role-smoke.spec.ts` | Every nav item per role renders without error |
| `link-crawl.spec.ts` | Generic crawl from each dashboard, catches 404s/console errors |
| `feedback.spec.ts` | Success/error toasts fire on real mutations; flags fake-success stubs |

## Test data hygiene

`students-crud.spec.ts` and `procurement-workflow.spec.ts` create real
records on production. Every record they create is prefixed
`QA-E2E-DELETE-ME-<timestamp>` and the spec deletes/cancels what it created
in an `afterEach`/`afterAll` hook — but if a run is interrupted mid-test,
search for that prefix across Students/Requisitions/Purchase Orders and
clean up manually.

## Known limitations

- 2FA is disabled site-wide in production today (`DEF-QA3-002`, a documented
  temporary mitigation) — the OTP branch in `auth.spec.ts` will report
  "not reachable" rather than a pass/fail until that changes.
- There's a second, unrelated `/otp` route in the app
  (`src/features/auth/otp/`) that is disconnected leftover template code —
  it doesn't call any real backend method. `link-crawl.spec.ts` will visit
  it (it's a real page) but `auth.spec.ts` doesn't use it, since the real
  2FA challenge renders inline in the sign-in form itself.
