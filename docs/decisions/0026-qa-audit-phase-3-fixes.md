# ADR 0026: Phase 3 fixes from the first deployment readiness audit

## Status

Accepted.

## Context

Following ADR 0023/0024/0025 (Phases 0-2), this covers 2 of the 3 Phase 3
(S5, backlog) defects from
`docs/qa/deployment-readiness-report-2026-09-12.md`. DEF-037 (WhatsApp
channel) is deliberately left open -- implementing it means picking a real
provider (Twilio, Meta's own Cloud API, 360dialog) and their message-template
approval workflow, a vendor/product decision this fix pass isn't positioned
to make unilaterally, the same class of decision DEF-028 (online payments)
was already correctly deferred for.

## Decisions

**DEF-024 -- Receipt integrity hash coverage, done safely.** The existing
hash (`_compute_receipt_hash`) covered only name/student/invoice/amount/
currency/date/payer -- not `payment_method`, `narration`, `received_by`, or
the split-tender breakdown, so a tampered printout changing those still
verified as valid. The direct fix (just add the fields to the payload) would
have been actively harmful: `verify_receipt()` recomputes the hash fresh and
compares it to the one stored at submit time, so changing the formula would
make every already-submitted production receipt's stored hash mismatch the
newly-recomputed one -- a false mass-tampering alarm across the entire
historical receipt base.

Fixed with a version marker instead: new `integrity_hash_version` field,
pinned once at submit and never changed after. `_compute_receipt_hash(doc,
version)` branches on it -- version 1 is the exact original payload
(unchanged, for every receipt that already exists), version 2 adds the four
fields above. `verify_receipt()` always recomputes using the receipt's own
`integrity_hash_version` (defaulting to 1 for any receipt that predates the
field), never the current version. New receipts get the fuller coverage;
every existing one keeps verifying exactly as it always has.

**DEF-022 -- Period Lock's chronological-order check, unconditional.**
`close_period()`'s out-of-order guard normally comes for free via
`_create_journal_entry()`'s own closed-period check -- but that function is
only called when the period has a nonzero net Income/Expense to post. A
period whose net happened to be exactly zero (e.g. no invoices/receipts fell
inside it at all) skipped the check entirely, since no Journal Entry was
ever created to run it against. Moved the same `_latest_closed_period_date()`
check directly into `close_period()`, applied unconditionally regardless of
whether a closing JE ends up posting.

## Consequences

- 2 real defects fixed, each with a regression test -- DEF-024's included a
  dedicated backward-compatibility test proving a pre-fix (version 1) hash
  still verifies correctly after the formula was extended.
- DEF-037 remains open, correctly flagged as needing a product decision
  rather than silently treated as done.
- `python -m py_compile` and JSON validation are clean. Not yet re-verified
  against a live bench run at the time this ADR was written.
