# ADR 0020: Sponsor/split billing, bank statement import, split-tender, and payment allocation

## Status

Accepted.

## Context

Four "Billing & receipting" gaps from the readiness report, requested together:
no way to record a sponsor as a receipt's payer (so a sponsored student's fees
looked identical to a family-paid one); no bank/mobile-money statement import
or matching (every payment had to be keyed in by hand from a bank portal);
no split-tender (a payment made partly cash, partly EcoCash had nowhere to go
except a single Payment Method field) and no tamper-evident receipt output;
and no structured allocation of a payment across a student's arrears/current
balance, nor a structured field for a bank reference to key matching off.

## Decisions

**Split billing is Receipt-level, not Invoice-level.** A `Sponsor` doctype
(simple master data, same shape as Parent Guardian) plus `Receipt.payer_type`/
`payer` (a Dynamic Link) records who actually paid a given receipt --
defaulting to the student's own Primary Guardian when left blank, so every
existing receipt-creation call site is unaffected. Two receipts against the
same Invoice, one with `payer_type: Sponsor` and one with the family as payer,
*is* split billing -- no separate invoice-splitting schema was needed, since
the invoice already supports multiple receipts against it.

**Bank statement import never auto-posts money.** `Bank Statement Import`
(+ `Bank Statement Line`) parses an attached CSV and auto-matches a line only
when a reference or description names exactly one real Invoice (directly, or
via exactly one Active student) *and* the amount matches that invoice's
outstanding balance exactly -- anything short of that is left `Manual Review`
for a Bursar to resolve via `set_manual_match()`. `confirm_statement_line()`
is the only place a real, submitted Receipt is ever created from this flow,
always requiring an explicit Bursar action -- the same "no financial action
fully automated" posture already chosen for not building a live EcoCash
webhook (ADR 0018).

**Split-tender is additive, not a schema replacement.** `Receipt` keeps its
single `payment_method`/`amount` fields for the common case; an optional
`tender_lines` child table (`Receipt Tender Line`) lets a receipt be paid via
several payment methods at once, validated to sum to exactly `amount`.
`create_journal_entry_for_receipt()` posts one JE debit line per tender when
present, falling back to the single `payment_method` otherwise -- every
existing Receipt (all with no `tender_lines`) is unaffected.

**Tamper-evidence is a recomputable hash, not a signature.**
`Receipt.integrity_hash` (SHA-256 of the receipt's immutable fields) is
computed on submit, matching the existing `portal_invitations.py`/Fee
Structure attachment-hashing convention. `verify_receipt()` recomputes it from
the document's live field values and compares -- a printed receipt's QR code
only ever needs to encode the receipt's own name. Deliberately **not**
`allow_guest=True`: an unauthenticated verification endpoint would let anyone
enumerate every receipt's student name and amount by guessing sequential
receipt numbers. It reuses the exact same read-permission scoping (
`doc.has_permission("read")`) as viewing the receipt itself, so a
Parent/Guardian can only verify their own child's receipt.

**Payment allocation reuses Receipt as the ledger unit for an Advance, rather
than a new doctype.** `record_payment_with_allocation()` splits one payment
across a student's outstanding Invoices oldest-`due_date`-first (so arrears
are always covered before anything current), one Receipt per invoice touched.
Anything left over becomes its own Receipt with no `invoice` set --
`allocation_type` (`Current`/`Arrears`/`Advance`) is computed automatically in
`validate()` from whether an invoice is set and, if so, whether `posting_date`
is past its `due_date`.

**An Advance is a real liability (Unearned Revenue), not a negative Debtors
balance.** Crediting Debtors for a prepayment with nothing to apply it against
would understate what students actually owe in aggregate. Instead, an Advance
Receipt's Journal Entry credits the existing **Unearned Revenue** account
(already present in `school_setup.py`'s seeded chart of accounts, so no new
account name needed). `Invoice._apply_available_advance()` -- run in
`before_insert()`, after `_carry_forward_prior_balances()` so an advance can
cover brought-forward debt too -- consumes a student's unapplied advance
Receipt(s) oldest-first into a negative `is_advance_applied` Invoice Line.
`create_journal_entry_for_invoice()` still recognizes the invoice's full new
charge as Income (accrual happens at billing, not payment) but adds a second
JE pair -- Dr Unearned Revenue / Cr Debtors for the applied amount -- so the
GL always balances and Debtors only ever reflects what's genuinely still
outstanding. A reversal of an Advance Receipt is blocked once any part of it
has been consumed by a later invoice, rather than allowing a reversal that
would silently desynchronize the two records.

## Consequences

- **A real bug was found and fixed during testing**: the integrity hash
  compared `str()` of raw field values, which differ between a just-inserted
  in-memory document (e.g. `amount` as a plain `int`) and a freshly reloaded
  one (`float`) -- `str(25)` != `str(25.0)`, so every genuine, untampered
  receipt failed `verify_receipt()`. Fixed by canonicalizing each field
  explicitly (`flt()` with fixed precision for amount, `getdate()` for the
  posting date) before hashing.
- **`Invoice._carry_forward_prior_balances()` (Phase "Onboarding & Records")
  means a student normally has at most one open outstanding Invoice at a
  time** -- any earlier one is folded into a new one automatically. This
  makes `record_payment_with_allocation()`'s multi-invoice-spanning loop a
  rare path in practice (most payments will only ever touch one invoice plus
  possibly an advance), though it remains correct for the cases where it does
  apply (older invoices predating this app's carry-forward behaviour, or a
  future school configuration that doesn't consolidate).
- **No fuzzy name matching in bank statement import** -- only an exact
  substring of a student's full name is considered, deliberately, since a
  loose match on a common name is exactly the kind of mistake that misapplies
  one family's payment to another's account. A statement line that doesn't
  name a real invoice or an unambiguous student is always left for manual
  review.
- **The new child doctypes (report cards, activities, disciplinary records,
  bank statement lines, receipt tender lines) inherit their parent's
  permission scope** -- no dedicated finer-grained RBAC of their own.
- Full test suite: 167 tests (up from 151), verified twice against the final
  rebuilt production image -- once via `bench migrate` and once via the full
  `run-tests` run immediately after backend redeploy. No frontend changes
  this phase (backend-only), so no frontend rebuild was needed.
