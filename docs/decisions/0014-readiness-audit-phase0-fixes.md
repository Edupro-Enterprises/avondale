# ADR 0014: Deployment Readiness Audit — Phase 0 fixes

## Status

Accepted.

## Context

An exhaustive deployment readiness audit (code trace of every FR/BR/NFR/AU/OF/INT
requirement in the v2.0 Technical Functional Specification, combined with live
workflow testing executed directly against production) found 19 deployment-blocking
(S1) findings. The audit's own phased recommendation named three fixes as "Phase 0
— before any go-live conversation": permission-configuration changes needing no
rebuild. This ADR covers that phase.

Two of the three Phase 0 items were not just code-traced but **live-confirmed** by
executing the actual failure during the audit, against production:

- A non-Administrator user holding only the System Manager role successfully
  created and submitted a Receipt (`RCPT-2026-00006`), directly violating spec
  §5.2.6's "Strict Separation of Duties: Cannot issue receipts... or post
  financial journals." System Manager's DocPerm on Receipt, Journal Entry,
  Invoice, Payment Voucher, and Fee Structure was, in every case, an unrestricted
  grant with no code-level check.
- The Master Permissions Matrix (§5.1) and BR-PRO-02 require that "final approval
  cannot be the same person as the requisitioner" on a Payment Voucher — but the
  self-approval guard on the Payment Voucher Workflow only ever compares the
  approving user against the *document's own owner* (the Bursar who drafted the
  PV), never against the originating Requisition's `requested_by`, and never
  against who performed the prior approval step. A single person holding two of
  {SDC Chairperson/Treasurer, School Head} could legally execute two of the three
  approval steps alone.

A third finding (BR-LED-02, AU-01/02) was code-traced rather than live-executed:
Receipt has both a DocPerm `delete:0` and a controller `on_trash` guard blocking
deletion outright, but Invoice and Journal Entry had neither — both could be
Cancelled (docstatus 1→2) and then Deleted through the ordinary UI/API with zero
application-level resistance, undermining the append-only ledger guarantee the
whole audit-trail framework depends on.

## Decisions

**System Manager's DocPerm on Receipt, Journal Entry, Invoice, Payment Voucher,
and Fee Structure is now read-only** (`write:0, create:0, delete:0`, and
`submit:0`/`cancel:0` where those existed). This is a pure permission-configuration
change, not a rebuild — every place this app itself creates these records
programmatically (`utils.py`'s `create_journal_entry_for_invoice`/`_for_receipt`/
etc.) already inserts with `ignore_permissions=True`, so none of that machinery is
affected. The Administrator account still bypasses Frappe's permission layer
entirely by framework design — that is a standard, accepted break-glass property
of Frappe itself, not something a DocPerm change can or should try to close, and
is documented as a residual, separately-tracked risk in the audit report. What
this closes is specifically the finding that was reproduced: a real staff account
holding *only* System Manager (not Administrator) acting as if it held Bursar/
School Head/Fees Approver privileges.

**Payment Voucher now tracks who performed each approval step**
(`co_approved_by`, `final_approved_by`, both read-only Link fields to User) and
`validate()` blocks a transition if the acting user either (a) matches the linked
Purchase Order → Requisition's `requested_by`, or (b) already performed the prior
approval step on this same voucher. This directly closes both halves of the
live-tested gap — same person as requisitioner, and same person occupying two of
the three approval seats — using the same "why frappe.only_for() isn't reliable
here" manual-role-check pattern already established elsewhere in this app
(`reports.py`, `portal_invitations.py`).

**Invoice and Journal Entry each gained an `on_trash` guard matching Receipt's
existing one**: once a document has ever been submitted (`docstatus != 0`), it
cannot be deleted, even after cancellation. A never-submitted Draft can still be
deleted normally — nothing is part of the ledger yet. Each doctype also gained an
`on_cancel` hook writing an Audit Log entry (reusing the existing
`_create_audit_log` helper), so a cancellation is now at least visible in the
audit trail even though full reversal-entry-required-with-approval (the complete
BR-LED-02 requirement) remains open — see Consequences below.

One correction to the audit's own characterization, discovered while writing this
fix's tests: Frappe's framework already refuses to *cancel* a document that
another still-submitted document links to (`check_no_back_links_exist`) — both
via an ordinary Link field (a Receipt referencing its Invoice) and via a dynamic
link (the Journal Entry every Invoice auto-posts on submit, via
`reference_doctype`/`reference_name`). In practice this means an Invoice can
never be cancelled at all until its own auto-posted Journal Entry is cancelled
first, and a Receipt can never be cancelled while its Invoice remains submitted.
The real, narrower gap this fix closes is the step *after* a document legitimately
reaches `docstatus=2` through that correct order — nothing stopped it from then
being deleted outright, discarding the record that it, or the transaction it
represented, ever existed. That is what the new `on_trash` guards close, on both
Invoice and Journal Entry, matching Receipt's existing one.

**Test coverage added alongside the fixes, not after**: `test_receipt.py` (new —
Receipt had no test file at all before this ADR, despite carrying this system's
most compliance-critical rules) covers the System Manager regression directly,
plus deletion-block and reversal-reason enforcement. `test_journal_entry.py` (new
— same gap) covers the balance check and the cancel-then-delete regression.
`test_invoice.py` gained a cancel-then-delete assertion. `test_payment_voucher.py`
gained two tests reproducing both live-tested same-actor scenarios exactly as the
audit executed them.

## Consequences

- **This closes the specific, reproduced findings — it does not implement full
  BR-LED-02.** A submitted Journal Entry can still be *cancelled* (Frappe's
  standard docstatus 1→2 transition) by any role with `cancel:1` (now: Bursar
  only, for Journal Entry); what's fixed is that cancellation can no longer be
  followed by deletion, and cancellation is now audit-logged. A true reversal
  requiring a logged reason *and a separate approval step* before a cancellation
  is accepted at all is still open — the audit report's Phase 1 recommendation.
- **Receipt reversal still has no usable frontend/API surface for an ordinary
  Bursar.** This ADR did not touch that gap (also a Phase 1 item) — the
  `reversal_of`/`reversal_reason` mechanism this fix's own tests exercise is
  still only reachable via direct document construction, not a real "Reverse"
  button anywhere in the product.
- **The same-actor check on Payment Voucher depends on Purchase Order →
  Requisition still existing and being reachable at approval time.** If either
  is ever deleted between Requisition raise and final approval (not currently
  possible given existing DocPerm — Purchase Order has no `delete` grant beyond
  System Manager, which this ADR did not touch, and Requisition's `status`
  locks to `Closed` once a PO exists), the check degrades to only blocking the
  same-step-twice case, not the requisitioner case. Worth a follow-up guard if
  Purchase Order/Requisition deletion permissions are ever loosened.
- **Administrator remains an unrestricted break-glass account**, as in any
  Frappe deployment. This is intentional and out of scope for a DocPerm-level
  fix; it is the correct place to note it, not the place to try to close it.
