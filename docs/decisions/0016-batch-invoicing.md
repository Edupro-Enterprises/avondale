# ADR 0016: Batch invoicing with pro-rata support (Phase 1b)

## Status

Accepted.

## Context

The last named Phase 1 item from the readiness audit: FR-INV-01 (batch
invoicing by class/whole-school/category) and FR-INV-04 (pro-rata billing for
mid-term admissions) were both entirely unbuilt -- a school could not run a
term's billing cycle through this system at all; every Invoice had to be
hand-built one student at a time through the API.

## Decisions

**Invoicing is driven by an Approved Fee Structure, not a free-standing
filter set.** `run_batch_invoicing(fee_structure, grade=None)` takes the Fee
Structure's own `academic_year` and (if set) `beneficiary_category` as the
targeting criteria, adding only an optional `grade` parameter for "by class."
This is a deliberate reading of FR-INV-01's "by class, whole school, sponsor,
or beneficiary category" against how Fee Structure already works in this app
(ADR-implicit since Phase 1): a school billing different amounts to different
categories already expresses that by creating one Fee Structure per category,
not by re-selecting a category at invoicing time. Letting a Bursar pick an
arbitrary category at run time -- independent of which Fee Structure they
chose -- would let someone bill Category A students against a Fee Structure
built for Category B, which is a real footgun for no real benefit here.
"Sponsor" isn't offered as a filter at all: no sponsor concept exists
anywhere in the data model (a separate, already-tracked gap).

**Pro-rata uses the student's `admission_date` against the Fee Structure's
own Term dates** -- full amount if admitted on or before the term started,
`(days remaining in term) / (total days in term)` of every line item if
admitted partway through, zero if the admission date is somehow after the
term already ended (defensive; such a student shouldn't be in the eligible
set to begin with). This covers the "mid-term admissions" half of FR-INV-04
completely. The "withdrawals" half is **not** implemented: `Student` has no
`withdrawal_date` field to pro-rate *from* -- only a `Withdrawn` status flag
with no date attached -- so there is nothing to compute against. A withdrawn
student is simply excluded from the batch entirely (they're not `Active`,
so they were never going to be billed for a future term anyway); handling a
mid-term *withdrawal's* pro-rated refund/credit is a real, separate feature
that needs that missing field first, not something this batch run can retrofit.

**Idempotent by construction, not by a "have I run this before" flag.**
Every student is checked against `Invoice` for an existing
`(student, fee_structure)` pair before being billed; already-invoiced
students are reported back as `skipped_existing`, not re-billed. This means
a Bursar can always safely re-run a batch after adding late admissions,
correcting a student's category, or simply as a "catch anyone I missed"
sweep, without needing to remember who was already covered or risking a
double invoice.

**Each student's invoice commits independently** (`frappe.db.commit()`
after each successful submit, inside a per-student `try`/`except`) so one
student's failure -- a missing account, a malformed fee item, anything --
can't roll back students already successfully invoiced earlier in the same
run. Failures are collected and returned (`{student, error}` per failure)
rather than aborting the batch, matching the same "process sequentially,
report per-row failures" shape already used for BEAM disbursement CSV import
(ADR 0013).

**Role-gated to Bursar only**, matching who can create/submit an Invoice at
all post-Phase-0 (System Manager is read-only there now).

## Consequences

- **No UI to preview who would be invoiced and for how much before running
  it.** The Bursar picks a Fee Structure and grade filter and runs it; the
  result summary (created/skipped/failed counts and names) is only shown
  *after* the batch has already executed and submitted every resulting
  invoice. A "dry run" preview is a reasonable follow-up if a school wants to
  sanity-check a large run before committing to it, but isn't built here.
- **A student who changes category or grade between runs is not
  retroactively corrected** -- if they were already invoiced once under an
  old category, that invoice stands; only a fresh, not-yet-invoiced student
  gets picked up on a re-run.
- **Pro-rated withdrawal credits remain unbuilt**, blocked on a
  `Student.withdrawal_date` field that doesn't exist yet -- flagged above,
  not silently dropped.
