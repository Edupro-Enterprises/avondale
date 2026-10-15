# ADR 0011: Phase 7 (partial) — core financial statements

## Status

Accepted.

## Context

The `Financial Statements` frontend page had been a `ComingSoon` stub since Phase 4 —
correctly, since nothing computed statement-level figures yet. The roadmap's Phase 7 names
seven distinct deliverables (Statement of Receipts & Payments, Statement of Comprehensive
Income, Statement of Financial Position, Vote-Book Variance Report, Bank Reconciliation
Statement, MoPSE ED46 Termly Return, BEAM Claims Reconciliation, Fixed Assets/PRAZ Disposal
Register). This piece of work scopes the first three — the core general-purpose financial
statements every other report either feeds into or is a specialised variant of — and leaves
the remaining four as separate, later work.

## Decisions

**Computed on demand from the Journal Entry ledger, nothing stored or cached.** Three new
whitelisted methods in a new `edupro_school_fees/reports.py` (`get_receipts_and_payments`,
`get_comprehensive_income`, `get_financial_position`) aggregate `Journal Entry Account` rows
directly via SQL, grouped by `Account.account_type`. This mirrors Bank Reconciliation's own
`_compute_cashbook_balance()` precedent from Phase 6b — a report is a read over the ledger,
never a second source of truth that could drift from it.

**Receipts & Payments (cash basis) is defined by which accounts a Payment Method actually
pays into** — `Payment Method.account` is already this app's own definition of "a cash or
bank account" (used that way since Phase 1's Receipt/Cashbook Payment posting logic), so
reusing it here needs no new schema. Any Journal Entry Account row against one of those
accounts is a real cash movement; everything else (e.g. an Invoice's Dr Debtors) is accrual
activity that a *cash*-basis statement must exclude. Lines are grouped by the owning Journal
Entry's `reference_doctype` (Receipt, Cashbook Payment, Petty Cash Replenishment) rather than
by GL account — more meaningful to a Bursar reading the statement, and simpler than trying to
attribute each JE's non-cash counterpart line back to a category.

**Comprehensive Income (accrual, IPSAS 1) and Financial Position (balance sheet) are the
direct Dr/Cr rollup by `account_type`** — Income/Expense for the period for the former,
Asset/Liability cumulative-to-date for the latter. `accumulated_funds` is a balancing figure
(`total_assets - total_liabilities`): this app has never populated an Equity-type account, so
there is nothing more specific to net against, matching the "accumulated funds" language the
spec itself uses for a school (not a company with share capital).

**Every row is FX-normalized through its own snapshotted `exchange_rate`** (`jea.debit *
jea.exchange_rate`, from Phase 3) before summing — otherwise a school running both ZiG and
USD accounts would blend incompatible currency totals into one meaningless number. A
best-effort USD-equivalent is attached to every total via `get_exchange_rate()` at the
report's own date (not "today" — a March statement shouldn't shift every time it's re-opened
just because the rate has since moved), returning `None` rather than failing the whole report
when no Exchange Rate has ever been recorded for the pair.

**Access is Bursar/School Head/SDC Chairperson-Treasurer/District Education
Auditor-Inspector/System Manager only, enforced with a manual role check inside each
whitelisted method** (`frappe.only_for()` no-ops for Administrator and under
`frappe.flags.in_test`, per this project's established finding — see ADR 0008's era of
debugging). Parent/Guardian and Student are deliberately excluded: BR-PRT-02 explicitly bars
parents from school-wide financial reports.

**Test file lives at `doctype/journal_entry/test_journal_entry_reports.py`, not a top-level
`test_reports.py`.** `bench run-tests --app <app>` only discovers tests inside doctype
module folders — a loose file at the app root (matching how `portal_invitations.py`'s own
logic is tested from `doctype/portal_invitation/test_portal_invitation.py`, not a top-level
test file) is silently skipped by the full-suite run, confirmed by a re-run jumping from
96 to 102 tests only after relocating it. Journal Entry is the closest real "owner" of what
these reports aggregate.

## Consequences

- **Vote-Book Variance, Bank Reconciliation Statement, MoPSE ED46, BEAM reconciliation, and
  the Fixed Assets/PRAZ Disposal Register report are still not built.** Each already has real
  underlying data (Budget Line, Bank Reconciliation, Asset) from Phase 6b — what's missing is
  a dedicated report view/export for each, not the data itself.
- **No PDF/Excel/CSV export yet** (FR-FIN-04) — the frontend renders the three statements as
  live on-screen figures only. Print-to-PDF via the browser is available today as a manual
  workaround; a real export button is future work.
- **No comparative (current vs prior period) view yet** (FR-FIN-03) — the frontend takes one
  From/To range at a time. Re-querying with a different range already works; a side-by-side
  comparison view does not exist yet.
- Test coverage (`test_journal_entry_reports.py`): cash-basis netting across Receipt/Cashbook
  Payment-labelled entries, correct exclusion of non-cash (Debtors-touching) entries from the
  cash statement, period-bound vs cumulative-to-date behaviour, and the portal-role permission
  block.
