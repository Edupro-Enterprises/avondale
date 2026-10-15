# ADR 0010: Phase 6b — Budget Vote Book, Cashbook, Petty Cash, Bank Reconciliation, Asset
Register

## Status

Accepted.

## Context

Phase 6a delivered the procurement *authorization* chain (Requisition → PO → Payment
Voucher) but deliberately stopped short of two things it flagged as out of scope: budget
checking (nothing existed yet to check against) and actual disbursement (an Approved
Payment Voucher is "cleared to pay," not "paid" — no money moves, no Journal Entry). Phase
6b's roadmap entry names five things to build against that now-stable 6a: `Budget Vote
Book` (+ `Budget Line`, hard overspend blocking), `Petty Cash Book`, `Cashbook`, `Bank
Reconciliation`, `Asset Register` (+ depreciation) — "the heaviest new Journal Entry
producer in the roadmap."

Several schema decisions needed settling before writing code, each covered below.

## Decisions

**Budget Line is its own DocType, not a child table of Budget Vote Book.** A single vote
book covers a whole academic year and mixes Fund A and Fund B lines. SDC Chairperson/
Treasurer's fund-scoping (established in ADR 0009) works at the whole-document level via
`permission_query_conditions`/`has_permission` — that can filter *which* Budget Vote Book
documents are listed, but can't filter *rows inside* one document's child table. Making
Budget Line a real top-level DocType (linked to its parent Budget Vote Book, carrying its
own `fund`) lets SDC's fund-scoping apply to it exactly the same way it already applies to
Requisition/Purchase Order/Payment Voucher — no new permission mechanism needed.

**`budget_line` is a new required field on Requisition, fetch_from-chained through Purchase
Order and Payment Voucher** — the same one-hop-at-a-time pattern already used for
`fund`/`amount`/`currency`. This is the only schema change to 6a's three doctypes; their own
validate()/workflow logic is untouched.

**The hard overspend gate lives at Purchase Order creation, not Requisition or Payment
Voucher.** A Requisition only holds an *estimate*; the real committed number is the selected
quotation's amount, fixed at PO time — that's the genuine "spend commitment" moment (FR-PO-02:
"track encumbrance against budget votes"), and it's also where 6a already closes the
Requisition, so there's a natural single hook. `PurchaseOrder.validate()` checks
`Budget Line.available_balance >= amount` before insert; `after_insert()` books the
encumbrance (`committed_amount += amount`); a manual `status -> Cancelled` transition
releases it. This keeps Payment Voucher's already-tested workflow completely unmodified —
it only gains a read-only fetched `budget_line` field for display/chaining, satisfying the
plan's "interacts with every Payment Voucher submission" by construction (nothing reaches a
Payment Voucher without already being encumbered) rather than by adding a second check
inside PV's own controller.

**Budget Line tracks `committed_amount` (encumbered) and `actual_spend` (journal-posted)
separately, both subtracted from `approved_budget` to get `available_balance`.** This maps
directly onto the Phase 7 Vote-Book report's own required columns (FR-VOT-01: Approved
Budget, Cumulative Spend, Outstanding Commitments, Available Balance) — no translation layer
needed later. A single `Budget Line.adjust(committed_delta, actual_delta)` helper is the only
place either number is ever written, always recomputing `available_balance` from the fixed
`approved_budget` rather than a running total, so it cannot drift.

**Cashbook is a disbursement doctype (`Cashbook Payment`), not a duplicate transaction log.**
Cash *receipts* already have their own submit → Journal Entry path (`Receipt.on_submit`,
Phase 1); building a second "Cashbook" record for the same money would create two sources of
truth for one event. `Cashbook Payment` is the other half: it disburses an *Approved*
Payment Voucher, is the actual "heaviest new Journal Entry producer" (Dr the Budget Line's
own `expense_account`, Cr the Payment Method's account), and is the point where
`committed_amount` finally converts to `actual_spend`. FR-CBK-01's "daily transaction log
across all cash and bank movement" is satisfied by a Phase 7 report reading both Receipt and
Cashbook Payment's Journal Entry rows together, not by a redundant recording doctype.

**Petty Cash follows the traditional imprest-system split, not per-voucher journal
posting.** `Petty Cash Float` holds a fixed ceiling and a running `balance`; `Petty Cash
Voucher` deducts from that balance on submit but posts *no* Journal Entry (an unreimbursed
petty cash spend isn't yet a real GL event — it's tracked, per FR-PET-01). Only `Petty Cash
Replenishment` journal-posts, batching every `Pending Reimbursement` voucher on a float into
one JE per distinct expense account (Dr) balanced by a single credit to the replenishing bank
account — correctly keeping each voucher's own Budget Line charged even when one
replenishment run covers several different votes. "Disposal tracking" (FR-PET-03) is read as
closing a float, not a fixed-asset disposal (that's the Asset Register's unrelated meaning of
the word) — `Petty Cash Float.validate()` blocks a Draft→Closed-style transition while any
voucher on it is still `Pending Reimbursement`.

**Bank Reconciliation reuses the workflow-governance shape already proven by Fee
Structure/Payment Voucher** (Draft → Pending Head Sign-Off → Reconciled, with a Discrepancy
Flagged escape hatch back to Bursar) rather than inventing a bare status field, satisfying
FR-BRS-03's "sign-off by bursar and head." `balance_per_cashbook` is computed live from
submitted Journal Entry Account rows against the chosen bank Account up to `period_end` (a
single SQL join, not a stored/cached figure — there is exactly one source of truth for what
the ledger says a bank account holds). The `Reconciled` transition is blocked in `validate()`
while `variance` (reconciled_balance − balance_per_statement) is non-zero, giving FR-BRS's
sign-off gate real teeth rather than being advisory.

**Asset depreciation posts through the same `_create_journal_entry` helper as everything
else, run monthly by a new `scheduler_events["monthly"]` entry** (`run_asset_depreciation`),
mirroring the existing daily-job pattern (`run_debtor_ageing_escalation`,
`check_payment_plan_installments`). Depreciation is capped so `accumulated_depreciation`
never exceeds `historical_cost`, and a `Disposed` asset is skipped entirely. Each Asset
carries its own `depreciation_expense_account`/`accumulated_depreciation_account` rather than
reusing a Budget Line's `expense_account` — depreciation is a non-cash accounting entry, not
a procurement spend, and conflating the two would incorrectly move budget-line
`actual_spend` for money that was never disbursed through Cashbook Payment.

## Consequences

- **Requisition now requires a `budget_line`.** Every existing 6a test helper that
  constructs a Requisition needed updating to create (or reuse) a Budget Vote Book/Budget
  Line fixture first — done for `test_requisition.py` and `test_payment_voucher.py`. No
  production Requisition data existed yet at the time of this change (Phase 6a had only just
  deployed), so no backfill patch was needed; if this is ever repeated against a site with
  real Requisition rows, a patch to backfill `budget_line` would be required first.
- **A Budget Vote Book must be `Active` before any Requisition can be raised against its
  lines**, and a `Closed` vote book blocks both new Requisitions and new Budget Lines. There
  is deliberately no mid-year "amend approved_budget" workflow yet — a vote's ceiling is
  fixed once the book is Active; revising it means editing the Budget Line directly (System
  Manager/Bursar write access), which is acceptable for this phase's scope but may need a
  proper "Budget Amendment" audit trail later if real usage calls for it.
  - Reporting (the actual Vote-Book Variance Report, Bank Reconciliation Statement, and
  Fixed Assets Register documents named in spec §4.8/§4.9) is explicitly **not** built here —
  6b lands the data model and enforcement; Phase 7 reads it.
- Test coverage: `test_requisition.py`/`test_payment_voucher.py` extended for encumbrance
  creation/release and overspend blocking; `test_budget_line.py`, `test_petty_cash.py`,
  `test_bank_reconciliation.py`, `test_asset.py` added for each new doctype's own logic,
  including SDC fund-scoping on Budget Line (mirroring ADR 0009's pattern) and Cashbook
  Payment.
