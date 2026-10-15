# ADR 0015: Usable receipt reversal workflow (Phase 1a)

## Status

Accepted.

## Context

The readiness audit's Master Gap List named this the first Phase 1 item: the
`reversal_of`/`reversal_reason` mechanism on Receipt was real at the DocType
level (the audit itself used it, by constructing the document directly), but
had no frontend button, no whitelisted API method, no supervisor-approval gate
(FR-REV-02: "Only authorized supervisors can create reversals"), and no
automatic compensating ledger entry (FR-REV-04) -- a reversal only netted out
correctly if whoever booked it happened to also know to key in a negative
amount, which nothing in the schema or UI suggested or enforced. Separately,
the original receipt's own `status` field never actually flipped to
`Reversed` anywhere in the code, despite that Select option existing since
Phase 1.

## Decisions

**Request/approve, matching the Bursar-drafts/senior-role-approves pattern
already used everywhere else in this app** (Fee Structure: Bursar drafts,
Fees Approver approves; MoPSE ED46: three independent whitelisted
certification methods). A Bursar calls `request_receipt_reversal(receipt,
reversal_reason)`, which drafts a new, unsubmitted Receipt referencing the
original -- nothing is posted, no balance changes, yet. A School Head (the
spec's named authority for "credit notes, billing reversals, and write-offs"
in 5.2.2) calls `approve_receipt_reversal(reversal_receipt)`, which stamps
`reversal_approved_by`/`reversal_approved_on` and submits it in the same call.
`Receipt.before_submit()` independently re-checks that approval is present --
not just the whitelisted method's own role check -- so a Bursar attempting to
submit a reversal directly through the ordinary `/api/resource/Receipt` API,
skipping the approval step entirely, is still blocked server-side.

**No new DocPerm grant for School Head on Receipt.** They still only have
`read:1`, exactly as before this change. `approve_receipt_reversal` is the
single, deliberately narrow elevation point (`doc.flags.ignore_permissions =
True` inside that one whitelisted method, after its own explicit role check)
-- the same shape as the ED46 certification methods, chosen for the same
reason: broadening a role's general DocPerm to enable one specific action
opens surface area for everything else that DocPerm also grants, where a
narrow whitelisted method opens exactly one door.

**`create_journal_entry_for_receipt` now branches on `doc.reversal_of`**: a
reversal posts the literal opposite of a normal receipt (Dr Debtors / Cr
Cash-Bank instead of Dr Cash-Bank / Cr Debtors) and restores the invoice's
outstanding balance by the same amount it once reduced, recomputing `status`
(`Paid`/`Partly Paid`/`Unpaid`) from the result rather than assuming which
direction it moved. This makes correctness structural: whatever amount a
reversal carries, it always exactly cancels its original's ledger and balance
impact, with no dependency on sign convention or operator discipline.
`Receipt.on_submit()` sets the original's `status` to `Reversed` at the same
point the reversal itself posts -- the gap the audit's own live test surfaced
empirically (a reversal it created stayed invisibly "Submitted").

**Frontend**: a "Reverse" action per receipt (Bursar only, only on
`Submitted` receipts with no reversal already pending) prompts for a reason
and calls `request_receipt_reversal`; a "Pending reversal approvals" card
(visible to both roles, action only for School Head) drives
`approve_receipt_reversal`. `receipts/page.tsx`'s `canRecord` also had a
latent bug fixed alongside this: it still listed `"System Manager"` as
allowed to record receipts, a UI leftover from before ADR 0014 restricted
that role's DocPerm to read-only -- the button would have rendered for a
System Manager and then failed server-side. It now matches the real
permission: `Bursar` only.

## Consequences

- **This is still request/approve, not a fully separate multi-party
  workflow with its own `workflow_state`.** Receipt stays a plain
  submittable doctype (`docstatus`-based), not a Frappe Workflow doctype like
  Payment Voucher -- a Draft reversal with `reversal_of` set *is* the
  "pending approval" state, distinguished by `docstatus=0` plus a non-null
  `reversal_of`, rather than a named state. Simpler for a two-step
  request/approve shape; would need revisiting if a third approval step were
  ever required.
- **A reversal cannot itself be reversed** (`request_receipt_reversal`
  throws if the target is already a reversal), and **only one reversal per
  original may be in flight at a time** (throws if a Draft or submitted
  reversal already exists for it) -- both deliberate, to keep the audit
  trail a single clean original-then-reversal pair rather than a chain.
- **The reversal amount is always the original's full amount** -- there is
  no partial reversal. If a school ever needs to correct a receipt that was
  merely mis-allocated rather than fully wrong, this still requires a full
  reversal plus a fresh correct receipt, not an in-place adjustment.
