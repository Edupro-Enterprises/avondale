# ADR 0009: Phase 6a — basic procurement flow

## Status

Accepted.

## Context

The roadmap named Phase 6a's scope precisely: `Requisition`, a `Quotation` child table
(PRAZ 3-quote control), `Purchase Order`, and `Payment Voucher` with "sequential
Requisitioner→Bursar→SDC Chair→School Head approval, same workflow pattern as Fee
Structure" — delivering the spec's mandatory dual-signature authorization loop. Two
things needed a real decision before writing code: what "Requisitioner" maps to (no such
Frappe role exists in this app), and whether this phase also posts to the ledger.

## Decision

**Chain**: `Requisition` (items + a `fund`, matching `Account.fund`'s existing two-value
option set) → its own `quotations` child table (`Quotation Item`: vendor, amount,
currency, attachment, `is_selected`) → `Purchase Order` (`requisition` Link; `validate()`
enforces at least 3 quotations and exactly one selected, then copies that quotation's
vendor/amount/currency onto itself; `after_insert()` closes the Requisition so a second
PO can't be raised against it) → `Payment Voucher` (`purchase_order` Link; `amount`/
`currency`/`fund` all `fetch_from`-chained back through PO to Requisition, one hop at a
time — no controller code needed for that part).

**"Requisitioner" collapses into the Draft state, not a separate role.** The plan's own
phrasing names four checkpoints, but the spec's RBAC matrix only ever assigns Bursar to
both *drafting* Payment Vouchers and *verifying vote* — the same person doing two listed
duties, not two distinct approvers. Inventing a `Requisitioner` role with no other purpose
in this app would be a role with a single member and no real distinction from `Bursar`.
The workflow instead has three real sequential approvers: **Bursar** (Draft →
submit), **SDC Chairperson/Treasurer** (co-approve or reject), **School Head** (final
approve or reject) — `Draft → Pending SDC Co-Approval → Pending School Head Approval →
Approved`, with a `Rejected` exit from either approval stage. Built as a real Frappe
Workflow (`fixtures/workflow.json`, the location Phase 5.1's own debugging established as
the one that actually loads — see the `f0ad760`/`fe93f56` commits), so the sequential
gate is genuinely enforced by the framework, not just implied by field permissions.

**SDC's Fund A/B scoping is closed here, not deferred again.** ADR 0005 flagged this gap
explicitly when Phase 5.1 only gave SDC Fee Structure and read-only GL access ("SDC
Chairperson/Treasurer can technically read Fund A accounts... flag before this role is
actually handed to a real user"). Phase 6a is exactly that moment — SDC's first real
co-approval duty, and one the spec ties directly to fund ("No access to Fund A"). Added
`permission_query_conditions`/`has_permission` on `Requisition`/`Purchase Order`/`Payment
Voucher`, restricting SDC to `fund = "Fund B - SDC/SDA"` rows only, mirroring Phase 5.1's
dual-layer pattern but for an *internal* role's fund boundary rather than a family's
records — a different concern, kept in its own section of `permissions.py` rather than
folded into the portal-role logic.

**No ledger posting.** Approving a Payment Voucher only moves its own `workflow_state` to
`Approved` and stamps `approved_on` — it does **not** create a Journal Entry. The
roadmap's own phase split puts "heaviest new Journal Entry producer" under Phase 6b
(Budget Vote Book, Cashbook, Bank Reconciliation), and 6a's stated goal is specifically
"the core spend-authorization loop" — getting a voucher through its signatures, not
disbursing money. `payment_method` is captured on the voucher as a record of *intent*
(which account this will eventually pay from) for 6b to consume, not acted on here.

## Consequences

- **Budget checking doesn't exist yet.** The spec's Bursar duty "verify available budget
  lines" has nothing to verify against until Phase 6b's Budget Vote Book exists — the
  Bursar's "Submit for Approval" transition is currently a procedural step, not a real
  budget gate. Flag this if a Payment Voucher is ever approved for spend genuinely
  beyond what the school can afford before 6b lands.
- **No actual money moves.** An `Approved` Payment Voucher is an authorization record,
  not a payment — there is no disbursement, no Cashbook entry, no bank reconciliation
  line. Treat "Approved" as "cleared to pay," not "paid."
- Test coverage (`test_requisition.py`, `test_payment_voucher.py`) exercises the PRAZ
  3-quote/single-selection validation, the Requisition-closes-after-PO rule, the real
  sequential workflow (including that a direct Draft→Approved skip is rejected, the same
  class of check Phase 5's workflow-fixture bug made silently pass before it was fixed),
  and SDC's fund scoping on all three doctypes.
