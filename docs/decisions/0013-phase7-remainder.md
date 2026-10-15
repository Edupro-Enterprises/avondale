# ADR 0013: Phase 7 (closing) — Vote-Book Variance, Bank Reconciliation Statement, export, comparative periods, BEAM import

## Status

Accepted.

## Context

ADR 0011/0012 covered the core statements and three named statutory reports. This closes
out the remaining Phase 7 items from the original roadmap: the last two named reports
(Vote-Book Variance, Bank Reconciliation Statement), CSV/PDF export (FR-FIN-04/FR-ED46-04),
comparative-period reporting (FR-FIN-03), and BEAM disbursement file import (FR-BEAM-03).

## Decisions

**All five pieces needed zero backend changes.** Every underlying figure already existed:
Budget Line already carries approved/committed/spend/available (Phase 6b); Bank
Reconciliation already computes balance-per-cashbook/reconciled-balance/variance and already
has its own workflow (Phase 6b) but had never been given a frontend at all until now; the
core statement endpoints (ADR 0011) already accept arbitrary date ranges, so a "prior period"
is just a second call with different dates; and BEAM disbursements already go through
`recordBeamDisbursement()` (ADR 0012) one call at a time. This phase is a genuinely
frontend-only close-out.

**Export is CSV + browser print, not server-side PDF/.xlsx generation.** CSV opens cleanly
in Excel/Sheets/Numbers without pulling in an .xlsx-writing library for a real binary format
nothing else in this app needs; the browser's own Print > Save as PDF already produces a
clean PDF once `AppShell`'s chrome (header/sidebar/action buttons) is hidden under a
`print:hidden` variant — no new dependency, no server-side rendering pipeline. A shared
`ReportActions` component (`components/staff/report-actions.tsx`) and `lib/export.ts`
(`downloadCsv`/`printReport`) are used identically across every report page, added to all
six from ADR 0011/0012 as well as the two new ones here.

**Comparative periods reuse the *same* statement endpoints with a computed prior range**,
not a new "comparative" backend method. The prior period is the same length, immediately
preceding the current `from_date` (`from_date - 1 day` back to `from_date - period_length`);
for Financial Position (a cumulative snapshot, not a period), the comparative point is simply
"as at the day before the current period began" — the standard prior-year-end convention. A
checkbox toggles a second set of SWR fetches (conditionally keyed, so nothing is requested
until comparison is switched on), and each `TotalRow` grows an optional muted "Prior period:"
line rather than a parallel full statement layout — simpler to read at the total-line level
that actually matters for a variance conversation, without restructuring every section.

**Bank Reconciliation gets its first frontend at all** — list, create (with a genuinely
dynamic reconciling-items sub-form: add/remove Deposit-in-Transit/Unpresented-Cheque/Bank
Charge/Other rows before submitting), and the same per-role workflow actions pattern already
established for Payment Voucher/Fee Structure/Debtor Case (`Draft` → `Pending Head Sign-Off`
→ `Reconciled`/`Discrepancy Flagged`, Bursar submits, School Head signs off or flags). The
report list itself shows the headline per-reconciliation figures (balance per statement,
balance per cashbook, reconciled balance, variance, status) rather than itemizing every
adjustment line inline — the underlying computation already reflects every adjustment in
`reconciled_balance`; a full itemized drill-down per reconciliation is a smaller follow-up if
ever needed, not built here.

**Vote-Book Variance Report needed no new data functions at all** — `listBudgetVoteBooks()`
and `listBudgetLines()` (both already existed, used by the internal dashboards) are exactly
FR-VOT-01's field list already. `% Spend Burn` is computed client-side
(`(committed + spent) ÷ approved`), the one figure genuinely new to this report.

**BEAM disbursement import defines its own minimal CSV shape** (`claim name, amount
disbursed, reference`) rather than guessing at an undocumented real MoPSE/Treasury file
format — there is no spec or sample file to target. Each row calls the exact same
`recordBeamDisbursement()` the manual "Record Disbursement" button already uses, processed
sequentially so one malformed row doesn't abort the rest of the file; a summary reports
successes and per-row failures after the fact.

## Consequences

- **No true .xlsx binary export anywhere** — CSV is the spreadsheet-compatible deliverable
  throughout. If a school specifically needs formatted, multi-sheet Excel workbooks later,
  that's a real library addition (e.g. SheetJS) and its own scoped piece of work.
- **No server-rendered PDF** — export-to-PDF is "open the browser's print dialog," which
  depends on the user actually choosing Save as PDF rather than a physical printer. Fine for
  a school bursar at a desk; not suitable for an unattended/scheduled report-generation flow
  if one is ever needed.
- **Bank Reconciliation's report list doesn't itemize adjustment lines per row** — the
  reconciled figure already accounts for them; seeing the individual Deposit-in-Transit/
  Unpresented-Cheque entries for a specific reconciliation means opening it directly (not yet
  exposed as a drill-down view).
- **Comparative periods only compare the current range against the one immediately
  preceding it** — not an arbitrary pair of periods, and not last year's same period
  specifically (e.g. Term 1 2026 vs. Term 1 2025) unless that happens to be the immediately
  preceding range.
- This closes every item the roadmap named for Phase 7. What remains system-wide is Phase
  5.6 (EcoCash/bank-transfer parent payments) and Phase 8 (offline-resilient architecture),
  both already flagged as not started.
