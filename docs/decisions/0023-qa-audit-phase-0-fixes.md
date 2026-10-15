# ADR 0023: Phase 0 fixes from the first Deployment Readiness Report

## Status

Accepted.

## Context

`docs/qa/deployment-readiness-report-2026-09-12.md` is the first formal, code-level
deployment readiness audit of this system (six independent passes, one per functional
module, each reading the actual code end to end rather than trusting prior test-suite
results). It found 39 real defects and returned a **NO-GO** verdict, anchored on two
Severity-1 blockers plus ten Severity-2s. This ADR covers the twelve items the report
scoped as "Phase 0" -- fix before any deployment, pilot or otherwise.

The report itself could not be re-verified live this round (no SSH/bench access, no
test credentials) -- everything below was implemented and cross-checked by static
reading, `python -m py_compile` (clean), and JSON validation (clean), matching the
audit's own methodology. A live full-suite run against a rebuilt production image is
still the outstanding verification step before this can be called genuinely closed.

## Decisions

**DEF-001 (S1) -- Fund A Payment Vouchers were permanently deadlocked.** The workflow
was fund-agnostic; SDC's permissions were fund-scoped to Fund B only. A Fund A voucher
submitted for approval landed in "Pending SDC Co-Approval" and could never move again,
since no other role's transition could act on that state and SDC couldn't even see it.
Fixed in `PaymentVoucher.validate()`: when a Draft voucher's next state is "Pending SDC
Co-Approval" and its fund isn't Fund B, it's redirected straight to "Pending School
Head Approval" -- enforced centrally regardless of what any caller (frontend or Desk)
actually requests. A matching `workflow.json` transition (Draft -> Pending School Head
Approval, Bursar, action "Submit for Approval (Fund A)") was added alongside the
existing one, as belt-and-suspenders in case Frappe's own framework validates the raw
state-transition graph on a plain save (uncertain without live execution -- the edge
costs nothing to have either way).

**DEF-002 (S2) -- Credit Note approval never checked the approver's role.** Only "is
this a different person than the drafter" was checked -- any Bursar, not just School
Head, could approve a colleague's write-off. Added an explicit
`"School Head" not in frappe.get_roles(...)` check in `CreditNote.validate()`, the same
class of fix this file's own comment already documented needing for self-approval.

**DEF-003 (S2) -- `get_ageing_summary()` had no role check.** The one reporting
endpoint in the app that didn't call `_require_internal_role()` -- reachable by any
authenticated user, including Parent/Student, for school-wide debt figures. Fixed by
calling the same helper every sibling report already uses.

**DEF-004 (S2) -- the School Setup banking wizard was disconnected from the actual
receipting engine.** `Payment Method.account`, not `School Banking Configuration`, is
what `create_journal_entry_for_receipt` posts against -- the wizard's data was
descriptive only. Added an `account` Link field to `School Banking Configuration` rows
and a `sync_payment_methods()` step (alongside the existing `generate_chart_of_accounts()`)
that ensures a matching Payment Method exists for every active row with an account set.
Rows without an account are left alone, so this can never retroactively break a School
Setup singleton saved before the field existed.

**DEF-005 (S2) -- the default Chart of Accounts gave Fund B no bank/cash/expense
accounts.** Only two Income leaves existed for Fund B; a school going live on the
defaults had no way to record an SDC disbursement without manually creating accounts
first (and nothing then stopped those from being mistakenly tagged Fund A). Added
`Bank - SDC`, `SDC Cash-in-Till`, and three Fund B expense accounts to the generated
default set.

**DEF-006 (S2) -- Fee Item/Fee Structure Item had no currency field.** Added a
`currency` Select (ZiG/USD, default ZiG, required -- backfilled for existing rows by
Frappe's own schema-sync default-on-add-column behavior) to Fee Item, fetched through
to Fee Structure Item and Invoice Line, with `Currency` fields wired to it via `options`
for correct per-row formatting. **Deliberately scoped narrow**: this makes currency a
real, visible, settable field, but `create_journal_entry_for_invoice()` still sums
`row.amount` as a single figure without converting a USD-denominated line into ZiG
before combining it with ZiG lines in one balanced JE -- true multi-currency-safe
posting is the dedicated Currency/FX Foundation phase already scoped in the existing
roadmap plan, not a same-session addition to the live posting engine without any way to
run the test suite. Documented as a code comment at the call site. Until that phase
lands: price fee items actually billed in ZiG, or keep USD items on their own invoices.

**DEF-008 (S2) -- Invoice Line had no funding-source field.** One Fee Structure meant
one funding source for every line -- a BEAM-funded Tuition charge and a parent-billed
Science Practical fee on the same invoice couldn't be told apart. Added an optional
`beneficiary_category` override on Fee Structure Item (falls back to the structure's
own category when blank) and a resolved, read-only `beneficiary_category` on Invoice
Line, filled in by a new `Invoice._resolve_beneficiary_categories()` step in
`validate()` -- covers both manually-created invoices and `run_batch_invoicing()`
uniformly, since both funnel through the same `validate()`. The per-line override is
now also covered by Fee Structure's existing "cannot edit after Approved" item-diff
check, alongside `fee_item`/`amount`.

**DEF-009 (S2) -- per-line income accounts were silently ignored.** Every regular
invoice charge posted to one hardcoded "Fees Income" account regardless of what each
Fee Item was actually configured against, even though `Invoice Line.account` (fetched
from `Fee Item.account`) was already being captured. Fixed in
`create_journal_entry_for_invoice()`: charges are now grouped by their own line's
account and posted as separate credit lines, with a single Dr Debtors line still
covering the combined total (debit=credit holds by construction, since the grouped
credits sum to the same total the single Dr line already used).

**DEF-010 (S2) -- non-atomic double-invoicing race in batch billing.** The
exists-check-then-insert in `run_batch_invoicing()` had no lock, so two overlapping
runs (a scheduled retry racing a manual one, or two Bursar sessions) could both pass
the check for the same student before either committed. Fixed by taking a `FOR UPDATE`
lock on the Student row (`frappe.db.get_value(..., for_update=True)`) for the rest of
each iteration, released at the same `frappe.db.commit()` the loop already does per
student -- serializes concurrent attempts on the *same* student without blocking other
students' rows, and needs no schema migration or risk against a DB that might already
hold duplicate data from the bug it's fixing.

**DEF-012 (S2) -- Petty Cash Voucher bypassed the budget overspend control.** Purchase
Order already checked `Budget Line.available_balance` before committing; Petty Cash
Voucher never did, so a fully-committed vote could still be silently overspent through
petty cash. Added the same check, mirrored from `PurchaseOrder.validate()`.

**DEF-027 (S2) -- a guardian linked only via `secondary_guardian` was locked out of
their own child's portal entirely.** `_guardian_student_names()` matched only the
primary `guardian` Link. Fixed to match both -- a legitimate-access-denial bug, not a
cross-family leak (every other portal permission function was independently traced and
holds).

**DEF-029 (S2) -- System Manager could bypass the "no direct ledger posting" rule.**
Receipt and Journal Entry correctly block System Manager (`write:0` etc.), but Cashbook
Payment (posts an identical JE on submit), Petty Cash Voucher/Replenishment (same),
Requisition, Purchase Order (creation = issuance, commits a Budget Line), and Budget
Line (direct field edit, bypassing the `adjust()` invariant) all still granted System
Manager full `write/create/delete(/submit/cancel)`. Reduced all six to the same
`read:1` only shape Receipt/Journal Entry already use. Administrator itself is
unaffected (Frappe's own universal permission bypass for that specific account, not a
DocPerm matter) -- this closes the gap for any *other* user merely holding the System
Manager role, which is what the audit's separation-of-duties finding was about.

## Consequences

- Twelve real defects fixed, each with a regression test (or, for DEF-010's
  concurrency fix, relying on the existing idempotent-re-run test since genuine
  concurrent-transaction testing isn't practical in this suite).
- **Not independently re-verified live** -- no SSH/bench access this session. The
  next step before this can be called closed is a real `bench run-tests` against a
  freshly rebuilt production image, per this app's own established deploy pattern.
- DEF-006 is intentionally a partial fix -- see the scope note above and in
  `utils.py`'s `create_journal_entry_for_invoice()` docstring. Full multi-currency
  posting remains future work, already scoped in the roadmap.
- The 27 remaining defects from the report (S2 DEF-008 dependency work aside, the
  Phase 1/2/3 items) are unchanged and still open.
