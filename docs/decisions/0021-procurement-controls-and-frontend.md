# ADR 0021: Configurable procurement controls, vendor approval, sensitive-procurement co-sign, and frontend for Phases 3+4

## Status

Accepted.

## Context

Two pieces of work landed together in this deploy. First, the frontend for the
Billing & Receipting phase (ADR 0020) had been built but not yet deployed:
payer/split-tender/allocation on the receipts page, a bank-statement import
page, and a receipt verification page. Second, four "Procurement" gaps from
the readiness report: the PRAZ 3-quote rule was a hardcoded literal, not
threshold-banded or configurable; there was no vendor master/approval list
(vendor was free-text on a Quotation, so anyone could type any name); a
quotation's supporting document was optional and never actually checked
before a Purchase Order could issue against it; and there was no dual-
authorization tier for high-value ("sensitive") procurement beyond the
existing fixed three-step Payment Voucher chain.

The Procurement page itself had a larger gap underneath these four: it was
entirely read-only. There was no way to create a Requisition, log a
quotation, issue a Purchase Order, or create a Payment Voucher from the
frontend at all -- everything after Budget Vote Book setup depended on Desk,
which is locked to System Manager only (ADR 0006). Closing the four named
gaps meaningfully required building that missing creation flow too.

## Decisions

**Quote-count banding lives on the School Setup singleton, not a new
doctype of its own.** A `Procurement Quote Band` child table
(`procurement_quote_bands`) on School Setup pairs a minimum amount with a
required quote count; `get_required_quote_count(amount)` in `utils.py` picks
the highest band whose minimum the requisition's `total_estimated_amount`
meets or exceeds. An empty or unconfigured band table falls back to the
PRAZ baseline of 3 -- exactly the old hardcoded behavior -- so this ships
with zero effect on any existing school until someone deliberately
configures bands.

**Vendor is a real master doctype with an approval lifecycle, not a
Boolean flag on the old free-text field.** `Quotation Item.vendor_name`
(Data) becomes a fetched display field off a new `vendor` Link to `Vendor`;
`Vendor.approval_status` (Pending/Approved/Suspended) is settable only via
`approve_vendor()`/`suspend_vendor()` (School Head only), the same narrow-
elevation pattern already used for MoPSE ED46 certification and receipt-
reversal approval. `Purchase Order.validate()` now refuses to issue against
a quotation whose vendor isn't Approved, in addition to the existing
quote-count and single-selection checks.

**`quotation_document` is mandatory on every quotation row**, not only the
winning one -- an undocumented quotation was never real evidence of a
competitive process, so it shouldn't count toward satisfying the
requirement. This is a forward-looking schema change only: existing rows
saved before this change stay as they are (Frappe's `reqd` is enforced on
save, not retroactively), so no production data was touched.

**The sensitive-procurement tier is a validate()-layered precondition, not
a new Workflow state.** Frappe's Workflow engine is a strict linear state
machine per doctype; branching it conditionally on whether a specific
Purchase Order happens to be sensitive isn't something it supports cleanly,
and forking Payment Voucher into two parallel workflows would double the
surface to maintain. Instead: `Purchase Order.is_sensitive_procurement` is
computed automatically (`amount >= School Setup's
sensitive_procurement_threshold`, configurable, defaulting to 5000) and
fetched onto Payment Voucher; `PaymentVoucher.validate()` blocks the
existing Workflow's own School-Head "Approve" transition until
`sensitive_co_signed_by` is set, which only `co_sign_sensitive_procurement()`
(District Education Auditor/Inspector only, narrow-elevated the same way as
every other cross-role approval action in this app) can set. The normal
three-step chain (Bursar -> SDC Co-Approval -> School Head) is completely
unaffected for anything below the threshold.

**The Procurement page gets its actual creation flow**, not just the four
named fixes: a Requisition form, a per-requisition quotations editor (vendor
picker restricted to Approved vendors, live required-quote-count hint via a
new read-only `get_required_quote_count_for_amount()` endpoint, document
upload, select-the-winner, issue-the-PO), Payment Voucher creation from an
Issued PO, and a Co-Sign action on the Payment Voucher queue for the
District Education Auditor/Inspector role. A `Vendors` page handles the
approval list itself, mirroring the Payment Method precedent of no dedicated
management page only where the master data was already simple enough not to
need one -- Vendor's approval lifecycle made that no longer true here.

## Consequences

- **Existing Requisition/Payment Voucher test fixtures across the whole
  suite needed updating** (`vendor_name` free text -> a real, Approved
  `Vendor` record; every quotation row now carries a `quotation_document`) --
  a real, if mechanical, cost of tightening a previously-unvalidated field.
  All 175 tests (up from 167) pass against the final rebuilt production
  image.
- **No fuzzy vendor de-duplication** -- `Vendor.vendor_name` is unique, but
  nothing stops "ABC Suppliers" and "ABC Suppliers Pvt Ltd" from being
  logged as two different vendors.
- **A District Education Auditor/Inspector's co-signature has no time
  limit or expiry** -- once given, it stays valid even if the Purchase
  Order's own amount were somehow to change later (it can't today, since
  Purchase Order fields are all read-only/fetched after issuance, but this
  is worth remembering if that ever changes).
- **The Requisition quotations editor replaces the whole child table on
  every save** (`saveRequisitionQuotations` PUTs the full array) rather than
  a row-level API -- fine for the realistic size of a quotations list, but
  a concurrent-edit race (two Bursars adding a quotation to the same
  Requisition at once) would silently drop one's addition. Requisitions are
  Bursar-only to write, and in practice one person handles one procurement
  at a time, so this is a low-probability edge case, not a hardened design.
- Both images (backend and frontend) were rebuilt from scratch and
  redeployed together in this cycle; `bench migrate` and the full test
  suite were both run twice against the final images (once mid-cycle after
  the Procurement backend alone, once again after the combined rebuild) to
  confirm nothing regressed between the two rebuild steps.
