# ADR 0022: Ledger integrity checks, statutory reports, and security hardening

## Status

Accepted.

## Context

Eleven gaps across "Ledger & statutory reporting" and "Security & access":
no cross-check between Vote-Book totals and the GL; the Balance Sheet never
actually validated the accounting equation; 9 of the spec's 24 named reports
were missing; no real .xlsx/JSON export, only CSV/print; no year-end closing
or period lock; no letterhead/page numbering except (nominally) ED46; no
Credit Note/write-off doctype; the database isn't encrypted at rest; no MFA;
Audit Log covered a small fraction of real events; Fee Structure's Co-Sign
requirement (School Head + SDC, per spec 5.1) was never wired in; and SDC
could read Fund A through the raw Journal Entry list despite being
fund-scoped everywhere else.

**Not built: database encryption at rest.** This is a VPS/MariaDB storage
config change on a live production database, not application code -- doing
it wrong risks downtime or corruption, and it needs its own maintenance
window, not a silent side effect of an app deploy. Flagged as an
infrastructure recommendation instead.

## Decisions

**Reconciliation is a recompute-and-diff, not a stored ledger.**
`reconcile_budget_lines()` recomputes each Budget Line's committed/actual
totals straight from the Purchase Order/Cashbook Payment rows that are
supposed to drive `Budget Line.adjust()`, and flags any line where the two
disagree -- the same "recompute from source, don't trust a running total"
principle already used for Bank Reconciliation's cashbook balance.

**The Balance Sheet identity is now a real assertion, not a plug.**
`get_financial_position()` used to compute `accumulated_funds` as
`Assets - Liabilities`, which can never fail to balance regardless of what
the ledger says. It now sums real Equity-type accounts plus unclosed
Income-Expense, and reports `is_balanced`/`imbalance_amount` -- a genuine
double-entry check (every submitted JE is debit=credit by construction, so
in aggregate `Assets = Liabilities + Equity + Income - Expense` always
holds; a nonzero result means real corruption, not framing).

**Year-end closing is one doctype that does both jobs.** `Period Lock`
posts a real closing Journal Entry (each Income/Expense account's period
balance zeroed into the existing "Accumulated Fund" Equity account) and,
separately, blocks any future JE dated on or before its `closing_date`.
The lock is enforced once, centrally, in `utils._create_journal_entry()` --
every JE-producing path (Invoice, Receipt, Cashbook Payment, Credit Note,
...) respects it automatically, rather than each doctype re-implementing
the check.

**Credit Note mirrors Receipt reversal's shape, not a new pattern.** Draft
(Bursar) -> Approved (School Head) -> posts Dr Bad Debts Written Off / Cr
Debtors and reduces the Invoice. Discovered along the way: Frappe's
Workflow `allow_self_approval` flag is only ever checked inside
`apply_workflow()` -- this app's own frontend never calls that (it PUTs
`workflow_state` directly), so the flag was providing **zero** protection
anywhere it was relied on alone. Credit Note gets an explicit
`frappe.session.user == self.owner` check in `validate()` instead, matching
Payment Voucher's pre-existing `_block_same_actor()`. Worth auditing the
other declarative-only workflows later, but out of scope here.

**Fee Structure Co-Sign is validate()-layered, like sensitive procurement**,
not a new Workflow state: `school_head_co_signed_by`/`sdc_co_signed_by` must
both be set (via `co_sign_fee_structure()`, each independently, with the
same same-actor protection) before the Fees Approver's existing "Approve"
transition can succeed.

**SDC's Journal Entry access follows the same fund-scoping helper as every
other procurement doctype.** Journal Entry gets a `fund` column, set in
`_create_journal_entry()`: Cashbook Payment's own fund when the reference
is a Cashbook Payment, Fund A for fee-side entries (Invoice/Receipt/Credit
Note/Asset, which this app doesn't otherwise fund-tag), and **left unset**
for Petty Cash Replenishment (one JE can span both funds' expense accounts
in a single replenishment) -- an unset fund is invisible to SDC, the safe
default when attribution is genuinely ambiguous rather than a guess that
could leak Fund A.

**MFA reuses Frappe's own two-factor auth**, scoped via `Role.two_factor_auth`
to Bursar/School Head/SDC/Fees Approver/District Auditor. System Manager
(and so Administrator) is deliberately excluded -- there's no way to verify
a real OTP email round-trip from inside an automated deploy, and locking out
the one account every other fix in this app depends on would be a far worse
outcome than a School Head checking their email once at login. The frontend
login page gets a second OTP-entry step for the challenge response Frappe's
`/api/method/login` now returns for these roles.

**Nine reports, one page.** Census/EMIS, AGM Pack, Capital Projects, SDC
Receipts & Payments, Safe Balance, Class Fee Summary, Multi-Currency Trial
Balance, and Audit Trail Export share one tabbed `/reports/more` page rather
than eight separate ones -- each is a single read-only aggregation with no
state of its own. The ninth (Vote-Book Commitment Ledger) lives on the
existing Vote-Book Variance page instead, next to the reconciliation check,
since both are about the same vote lines.

**Real exports, applied everywhere at once.** `ReportActions` (the shared
component every report page already used for CSV/print) now also offers
.xlsx (`exceljs` -- `xlsx`/SheetJS has an unpatched high-severity
prototype-pollution/ReDoS advisory with no fix available, so was rejected),
JSON, and a letterhead + "Page X of Y" PDF (`jsPDF`/`jspdf-autotable`,
client-side, so it doesn't depend on a server-side PDF pipeline this app
doesn't have). Because this is the *same* component, all six pre-existing
report pages got real .xlsx/JSON/lettered-PDF export in this change too,
not just the nine new reports.

## Consequences

- **A real, previously-undetected bug was found by the new reconciliation
  check and fixed**: `Purchase Order.status` had a "Draft" default but
  nothing anywhere ever set it to "Issued" -- every Purchase Order in
  production has been silently stuck at "Draft" since Phase 4, which also
  meant the frontend's own "Create Payment Voucher" button (gated on
  `status === "Issued"`) could never have appeared. Fixed in
  `PurchaseOrder.validate()`: since there's no separate draft-then-issue
  step anywhere in this app (creation already closes the Requisition and
  commits the Budget Line), creation now sets status directly.
- **Fee Structure's co-sign requirement broke test fixtures in 9 other
  test files** that each had their own "approve a Fee Structure" helper --
  a real, if mechanical, cost of wiring in a previously-unenforced spec
  requirement that turned out to be a hard dependency for most of the
  suite.
- **Database encryption at rest remains a recommendation, not a change** --
  flagged to the user as its own infrastructure task.
- **MFA's OTP round-trip could not be live-verified** in this environment
  (no email inbox access, no authenticator app) -- the mechanism is real and
  uses Frappe's own tested code path, but a privileged user should confirm
  they can actually complete a login before relying on it.
- Full test suite: 186 tests (up from 175), verified against the final
  rebuilt production image. Five real failures surfaced during this phase's
  own test-writing (the Purchase Order bug above, the Credit Note
  self-approval gap above, a pre-existing report test's exact-total
  assertion breaking against this project's shared persistent database --
  fixed to assert a delta instead of an absolute, and two test-fixture
  mistakes of my own) -- all fixed and re-verified, not worked around.
