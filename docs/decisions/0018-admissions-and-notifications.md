# ADR 0018: Student admissions pipeline, plus email/SMS delivery

## Status

Accepted.

## Context

Two of the readiness report's larger gaps, requested together: the entire
admissions pipeline (FR-APP-01..07, FR-ENR-01..04) was unbuilt -- the Student
doctype only ever began at "already admitted," with no applicant record, no
application fee tracking, no assessment status, no document attachments, and
no offer-acceptance flow anywhere. And no automated communication of any
kind existed (INT-04/06, FR-COM-01, FR-PRT-14/15/16) -- Communication Log
only ever recorded what happened through some other, unspecified channel;
nothing in the app itself ever sent an email or SMS.

## Decisions

**A new `Applicant` doctype covers the whole pre-admission stage**, with
`enrol_applicant()` as the one deliberate handoff point into the real
`Student` registry -- Bursar-only, matching who can create a `Student`
directly today. Enrolling creates both a `Student` and a fresh `Parent
Guardian` record from the applicant's own contact fields; nothing de-dups
against an existing guardian (no de-dup logic exists anywhere else in this
app for Parent Guardian either, so this isn't a new gap, just an existing
one extended to a new entry point).

**No dual-signature gate on the admission decision itself.** Unlike Fee
Structure (Bursar drafts, Fees Approver approves) or Payment Voucher (three
sequential approvers), the spec names no such requirement for FR-APP/FR-ENR
-- so both Bursar and School Head can set an Applicant's status
(Under Review/Waitlisted/Accepted/Declined) directly via ordinary DocPerm
write access, with no whitelisted decision-gate method. The one thing that
*is* gated is the resulting `Student` creation (`enrol_applicant`,
Bursar-only) -- because that's the point where school data-entry
responsibility actually starts, not because the admission decision itself
needs two signatures.

**FR-ENR-03's "enrolment billing triggers" is deliberately not a new
concept.** Registration fees, boarding deposits, and infrastructure levies
are all just ordinary `Fee Item`/`Fee Structure`/`Invoice` records, exactly
like any other billing event -- a Bursar bills them the same way they'd bill
anything else, post-enrolment. Building a second, parallel "enrolment
billing" pathway alongside the one that already exists would only create
two ways to do the same thing.

**`Student.mopse_admission_number` is a plain optional field, not unique.**
It closes part of FR-STU-02 (a real, previously-flagged gap), but `unique:1`
on a field with years of existing blank rows is a known Frappe migration
trap -- multiple blank/empty-string values collide against a unique index
during migrate. Left as an ordinary Data field; enforcing real uniqueness
later, once every existing Student has a value, is a safer follow-up than
risking a failed migration now.

**Email uses Frappe's own `frappe.sendmail()`** — this module never touches
SMTP credentials; it relies entirely on whatever Email Account the site's
own System Manager has configured in Desk (the spec's own INT-14..18
env-var/secrets convention). **SMS uses Africa's Talking** (the spec's named
provider, INT-04), reading `africastalking_api_key`/`_username` from site
config. If those aren't set, SMS is silently skipped — not an error, and not
a fake log entry — so a school that hasn't configured SMS yet still gets
email rather than every notification failing. Neither channel's failure ever
propagates: a notification is always best-effort, wrapped so it can never
block the financial action (an invoice, a receipt) or admissions decision
that triggered it.

**Every attempt is logged to `Communication Log`** (FR-COM-04), which
gained one new field (`applicant`, alongside the existing `parent_guardian`)
since a pre-enrolment Applicant has no real Parent Guardian record to log
against yet — `parent_guardian`'s own `reqd` constraint was relaxed to a
plain optional Link, with the doctype's own `validate()` now requiring at
least one of the two.

**Four trigger points wired in** for this pass: Invoice submitted ("invoice
raised"), Receipt submitted, excluding reversals ("payment received" --
explicitly *not* sent for a reversal, since that's a correction, not new
money), an Applicant's status reaching Accepted/Declined, and a Debtor Case
crossing into Escalated (90+ days overdue) from the existing daily ageing
job. These are the highest-value points that already existed as real
doc/scheduler hooks in this app -- payment-plan-installment-overdue
reminders and statement-delivery notifications (also named in FR-PRT-14/15)
are not wired yet and are named here as the natural next extension, not
silently dropped.

## Consequences

- **SMS genuinely does nothing today** unless a school's System Manager
  configures `africastalking_api_key`/`_username` via `bench set-config` --
  this ADR builds the real, working integration code path, not a stub, but
  it has no test account behind it in this environment and was not
  live-verified end-to-end against Africa's Talking's actual API.
- **Email delivery depends entirely on this site's own outgoing mail
  configuration**, which this change doesn't touch or verify -- if no Email
  Account is set up in Desk, `frappe.sendmail()` may itself fail, in which
  case that attempt is logged as a caught error (`frappe.log_error`) and
  simply doesn't happen, silently from the triggering action's point of
  view (by design -- see "never blocks" above) but worth a school's own
  operational check before relying on it.
- **No de-duplication of Parent Guardian records** across multiple
  applicants/enrolments from the same family -- a pre-existing gap this
  change extends rather than introduces or fixes.
- **Payment plan installment reminders and generic statement-delivery
  notifications (FR-PRT-14/15) remain unbuilt** -- named explicitly as the
  next natural extension of this same `notifications.py` module.
