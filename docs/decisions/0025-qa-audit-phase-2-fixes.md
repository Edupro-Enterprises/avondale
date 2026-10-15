# ADR 0025: Phase 2 fixes from the first deployment readiness audit

## Status

Accepted.

## Context

Following ADR 0023 (Phase 0) and ADR 0024 (Phase 1), this covers 7 of the 8
Phase 2 (S4, "fix within 90 days") defects from
`docs/qa/deployment-readiness-report-2026-09-12.md`. DEF-039 (a moderate
transitive `uuid` vulnerability in `exceljs`, no non-breaking fix available
upstream) isn't a code fix to make -- re-confirmed unchanged via `npm audit`
and left as the same accepted, monitored risk ADR 0022 already recorded.

## Decisions

**DEF-033 -- session timeout.** `System Settings.session_expiry` defaulted
to "170:00" (170 hours) with nothing in this app setting it otherwise. New
patch sets it to 30 minutes (NFR-23).

**DEF-015 -- MoPSE Admission Number.** This app has no real MoPSE
integration to fetch a genuine number from -- MoPSE issues these externally,
so "auto-populating" one isn't honestly possible. `enrol_applicant()` now
accepts it as an optional parameter, and the frontend prompts for it at the
one moment a Bursar naturally has it in hand (enrolment), instead of it
being a field left to be remembered later with nothing flagging it as
outstanding.

**DEF-016 -- application fee posted to the GL.** Previously explicitly
"informational only" per its own field description. `Applicant.on_update()`
now posts Dr Cash-in-Till / Cr Application Fees Income (new default CoA
account) once a receipt number and amount are on record, guarded by a new
`application_fee_journal_entry` link so it can never double-post. Scoped to
ZiG-denominated fees only, the same boundary DEF-006 already drew -- no
per-line currency conversion exists yet to safely post a USD amount into a
ZiG-denominated pair of accounts.

**DEF-018 -- Cost Center/department entity.** New `Cost Center` doctype
(name, parent, is_group, description -- same lightweight tree pattern
Account already uses, no NestedSet mixin) and an optional `cost_center`
Link on Account. Deliberately minimal: the spec names this entity in its
Data Model table with no further FR/BR detail to build against, so this
gives schools a real, usable classification dimension without inventing
unspecified deeper behavior (e.g. cost-center-scoped budgets) that isn't
actually asked for anywhere else in the spec.

**DEF-023 -- student statement export/letterhead.** Wired `<ReportActions>`
into the shared `StudentStatement` component (used by both the parent and
student portal views), flattening each invoice's line items into one
exportable table.

**DEF-035/036 -- QR code coverage and payload shape.** Added a QR to the
student statement (a return-to-source link, not a tamper check -- unlike
Receipt, a statement has no fixed integrity hash to verify against, since
it's a live aggregate that changes as new invoices/receipts post). Extended
the Receipt QR's encoded URL with the document-identifying fields INT-21
names (document type, student, posting date) as query parameters --
deliberately still never encoding the financially sensitive fields (amount,
payer) directly in a scannable code; those still only surface after login,
via `verify_receipt()`'s server-side integrity check, per ADR 0020's
existing security reasoning.

## Consequences

- 7 real defects addressed, each with a regression test where the change is
  backend-testable; `python -m py_compile`, JSON validation, and
  `npx tsc --noEmit` are all clean.
- DEF-016's GL posting inherits DEF-006's known limitation: a
  USD-denominated application fee is not auto-posted, by design, until real
  multi-currency-safe posting exists (the dedicated Currency/FX Foundation
  roadmap phase).
- Not yet re-verified against a live bench run at the time this ADR was
  written.
