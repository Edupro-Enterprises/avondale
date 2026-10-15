# ADR 0012: Phase 7 (continued) — MoPSE ED46 Return, BEAM Reconciliation, Fixed Assets Register

## Status

Accepted.

## Context

ADR 0011 covered the three general-purpose financial statements. This closes out three of
the four remaining named Phase 7 deliverables (Vote-Book Variance and Bank Reconciliation
Statement — both backed by real Phase 6b data with no dedicated report view yet — are still
outstanding).

## Decisions

**Fixed Assets Register needed no new backend at all.** Every field FR-FAR-01 names (Asset
Serial Code, Description, PRAZ Reference, Date Acquired, Historical Cost, Depreciation
Method & Rate, Accumulated Depreciation, Net Book Value, Physical Location,
Condition/Disposal Status) already exists on the `Asset` doctype from Phase 6b, and
depreciation is already calculated automatically (`run_asset_depreciation`'s monthly
scheduler job, also Phase 6b) — this is a pure frontend list page.

**`Student` gains a `grade` field** (free-text Data, not a Select) — FR-BEAM-02 explicitly
names "grade" as a required BEAM reconciliation column, and nothing in the schema tracked it
before. Left free-text rather than an enumerated Select: Zimbabwe's ECD-through-A-Level
structure (ECD A/B, Grade 1-7, Form 1-6, Lower/Upper Six) varies by school phase, and forcing
a single rigid enum across every school type this app might ever run at wasn't worth the
schema churn for what's fundamentally a display/reporting label, not something anything in
this app currently branches logic on.

**BEAM Claims get their own doctype (`BEAM Claim`), not a repurposed existing one.** Nothing
tracked "claimed vs disbursed" before. `get_beam_reconciliation()` (in `beam_claim.py`,
matching Debtor Case's own `get_ageing_summary` precedent of a doctype-owned report method)
computes `unpaid_claim` per row and a running `cumulative_unpaid_claim` per student — FR-BEAM-02
names both. **CSV import of BEAM disbursement files (FR-BEAM-03) is explicitly not built** —
disbursements are recorded one claim at a time via a "Record Disbursement" action on the
reconciliation screen instead. A real file-import pipeline (parsing a Treasury-issued format,
matching rows back to claims) is a meaningfully separate piece of work from the reconciliation
view itself.

**The MoPSE ED46 Return is a real, persisted, certifiable document — not an ephemeral
computed report like the three from ADR 0011.** FR-ED46-03 explicitly names three
independent certifying parties (Senior Bursar, School Head, SDC Chairperson) with no
inherent order, which doesn't fit Frappe's linear Workflow engine (used everywhere else in
this app) — that models a *sequence* of states, not three parallel sign-offs converging on
one. Modeled instead as three boolean fields (`bursar_certified`/`school_head_certified`/
`sdc_certified`), each settable only through its own dedicated whitelisted method
(`certify_as_bursar`/`certify_as_school_head`/`certify_as_sdc_chair`) that checks the caller
actually holds that specific role before writing — not generic DocPerm `write:1`, which
would let School Head or SDC edit fields they have no business touching (the snapshotted
header, the Bursar's own certification, anything). `MoPSEED46Return.validate()` promotes
`workflow_state` to `Certified` automatically once all three are true, and demotes it back to
`Pending Certification` if a certification is ever reversed — there is deliberately no
"un-certify" endpoint; today that only happens by directly clearing a field, which only
System Manager can reach.

**`generate_ed46_return(term)` snapshots figures rather than computing them live on every
view**, mirroring `Budget Line`'s snapshot-then-freeze philosophy: school header from School
Setup, `total_enrolment` (active Students in the term's Academic Year), `total_revenue_billed`
/ `levy_base_amount` (submitted Invoices for the term), `total_revenue_realized` (Receipts
against those Invoices). Re-running against an existing Draft/Pending return refreshes the
figures (a school correcting a data-entry error before certification shouldn't need to delete
and recreate); re-running against a Certified return is blocked outright — a statutory return
is a fixed point in time once three people have signed it, not something that silently
redrifts if the ledger changes afterwards.

**"Staffing support analysis" (FR-ED46-02) is a manually-entered free-text field, not
computed.** This app has no staff/HR/payroll doctype anywhere — establishment counts, filled
posts, and government salary-support data simply don't exist in this schema, and inventing a
whole staffing module to populate one field of one statutory return would be a different,
much larger piece of work than "build the ED46 report." The field is there and the return
can still be certified around it; the gap is documented, not silently papered over with
fabricated figures.

**Tests for `_make_term()` fixtures had a shared bug, now fixed everywhere it appeared**:
`Academic Year`'s own controller auto-generates three Terms on insert (established
precedent, `test_academic_year.py`), so a test helper that *also* manually inserts a "Term 1"
for that same Academic Year collides with `Term._validate_term_sequence()`'s one-term-per-number
rule. Both new test files (`test_beam_claim.py`, `test_mopse_ed46_return.py`) initially had
this bug; fixed by looking up the auto-generated term instead of inserting a duplicate.

## Consequences

- **Vote-Book Variance Report and Bank Reconciliation Statement remain the last two named
  Phase 7 report deliverables not yet built** — both already have real underlying data
  (Budget Line, Bank Reconciliation) from Phase 6b.
- **No CSV import for BEAM disbursements** (FR-BEAM-03) — disbursements are recorded
  one-by-one through the UI. A bulk-import pipeline is future work if real usage needs it.
- **No PDF/Excel export for any of these three** (FR-ED46-04's own export requirement, and
  the general FR-FIN-04) — same gap already flagged in ADR 0011 for the core statements.
- **No structured staffing/HR data anywhere in the system** — the ED46 return's staffing
  section will always be a manual summary, not a computed figure, until (if ever) a real
  staffing module is scoped.
- Test coverage: `test_beam_claim.py` (unpaid/cumulative computation, totals, negative-amount
  rejection, portal-role permission block) and `test_mopse_ed46_return.py` (header snapshot +
  enrolment, billed vs. realized revenue computation, the three-party certification reaching
  `Certified`, a role being blocked from certifying in a capacity it doesn't hold, and
  regeneration being blocked once Certified).
