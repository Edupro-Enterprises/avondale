# ADR 0024: Phase 1 fixes from the first deployment readiness audit

## Status

Accepted.

## Context

Following ADR 0023's Phase 0 fixes, this covers 14 of the 16 Phase 1 (S3, "fix
within 30 days of go-live") defects from
`docs/qa/deployment-readiness-report-2026-09-12.md`. The remaining two --
DEF-028 (online/mobile payment initiation) and DEF-034 (offline-resilient
architecture) -- are net-new subsystems, not fixes to something broken; both
are already their own dedicated phases in the internal roadmap plan (a
payment-gateway integration and a full PWA/service-worker/local-queue/
conflict-resolution layer respectively) and are deliberately out of scope
here rather than rushed.

## Decisions

**DEF-038 -- frontend security headers.** The Frappe backend already sends a
full set (HSTS, X-Frame-Options, nosniff, XSS-Protection); the Next.js
frontend, the actual UI surface for 6 of 7 roles, sent none. Added via
`next.config.ts`'s `headers()`, same-origin CSP (`'self'`-scoped, no second
host to allowlist given the shared-domain Traefik routing). Verified locally
against a real dev server + browser pass -- clean, no console errors, no CSP
violations (the one advisory message, `eval()` blocked, is React's own
dev-mode-only warning and explicitly does not apply in production).

**DEF-025 -- report-generation audit logging.** Added `_log_report_generated()`
to `reports.py` (same shape as `get_audit_trail_export()`'s pre-existing
self-log) and called it from all 12 other report-producing endpoints across
`reports.py`, `statutory_reports_extra.py`, `mopse_ed46_return.py`,
`beam_claim.py`, and `debtor_case.py` -- previously only 1 of ~14 logged.

**DEF-031 -- audit log for role/permission changes.** New `User`
`doc_events["on_update"]` hook comparing role-name sets before/after (not
`has_value_changed`, which is unreliable for Table fields -- the same
caution Fee Structure's own item-diff check already documents).

**DEF-032 -- partial.** Bank Reconciliation state changes are now logged
(same `doc_events` pattern as every other workflow doctype). Failed-login
and backup events are **not** fixable the same way: Frappe core has no
public hook for either (traced directly in the running container's
`frappe/auth.py` -- `LoginAttemptTracker` tracks failures in Redis, never
through a Document save, and there is no `on_login_failed` trigger; backups
are an infra/cron concern outside this app's site context). Monkey-patching
framework internals for this was judged not a safe same-session change --
flagged as infrastructure-level, same treatment as DB encryption at rest in
ADR 0022.

**DEF-030 -- MFA for System Manager.** Re-examined the prior deliberate
exclusion (ADR "enable_mfa_for_privileged_roles"): confirmed by reading
Frappe's own `twofactor.py` that 2FA only ever gates the web
`/api/method/login` flow, never `bench` CLI access -- so requiring it for
System Manager does not affect this project's own hot-patch/migrate/test
workflow, only a human logging into Desk UI via browser, which is now a
rare, high-privilege path worth the friction. New patch
(`enable_mfa_for_system_manager.py`), since the original patch already ran
and patches are one-shot.

**DEF-014 -- student withdrawal financial gate.** Doesn't hard-block
withdrawing a debtor (real schools do, and keep chasing the debt) --
`Student.validate()` now requires a Clearance Certificate Number on record
whenever status moves to Withdrawn/Transferred Out with a nonzero open
Invoice balance, so it can never happen silently.

**DEF-011 -- BEAM Claim linked to Invoice.** New optional `invoice` field;
when set, validates the claimed total doesn't exceed the invoice's actual
billed amount and that it's the same student's invoice. Optional so it
doesn't retroactively break existing claims.

**DEF-007 -- Period Lock audit-completion gate.** New
`confirm_audit_for_period_lock()`, District Education Auditor/Inspector
only (their DocPerm on Period Lock stays read-only by design, narrowly
elevated the same way `co_sign_sensitive_procurement` already is) --
`close_period()` now refuses to run until it's been called. Frontend
year-end-closing page updated with the new step and an audit-status badge.

**DEF-013 -- Fixed Assets/PRAZ Disposal Register.** The one named statutory
report with no implementing function at all, despite Asset already carrying
every field it needs. New `get_fixed_assets_disposal_register()` in
`statutory_reports_extra.py`; frontend gets a "PRAZ Disposal Register" card
alongside the existing full asset list.

**DEF-017 -- generic Journal Entry reversal.** Only Receipt had a guided
reversal flow. New `reverse_journal_entry(journal_entry, reason)`, School
Head only (matching Receipt reversal's and Credit Note approval's own
authorized-supervisor bar), posts the exact opposite of every line and
links both directions (`reversal_of`/`reversed_by`, new fields) --
routed through the existing `_create_journal_entry()` choke point (extended
with an `extra_fields` param) so it still respects the period lock and
exchange-rate snapshotting like every other posting.

**DEF-020/DEF-021 -- Petty Cash Replenishment fund attribution and
reconciliation.** `_create_journal_entry()` gained a `fund_override` param;
`petty_cash_replenishment.py`'s `on_submit()` now computes the fund set its
pending vouchers' Budget Lines actually touch and passes it through when
they're all the same fund (previously always left unset, meaning the SDC
Receipts & Payments report silently dropped real Fund B petty cash spend).
Separately, `reconcile_budget_lines()` now sums Reimbursed Petty Cash
Voucher amounts alongside Cashbook Payment when recomputing
`actual_from_source` -- previously any Budget Line that ever had petty cash
spent against it showed a permanent false discrepancy.

**DEF-019 -- `/reports/audit-trail` export/letterhead.** Wired
`<ReportActions>` in, matching every other report page.

**DEF-026 -- portal invitations now actually delivered.**
`create_portal_invitation()` calls the existing `notifications.py`
email/SMS senders with the invite link (`/invite/{token}`) -- previously
created but never sent, leaving the inviting Bursar to relay the token by
hand. Never raises on delivery failure, same contract as every other
notification in the app; the token is still returned in the response as a
fallback.

## Consequences

- 14 real defects fixed, each with a regression test; `python -m py_compile`,
  JSON validation, and `npx tsc --noEmit` are all clean.
- DEF-032 is genuinely only partially closed -- see the Frappe-internals
  finding above. Failed-login and backup-event audit coverage remain open,
  correctly scoped as infrastructure work rather than forced into app code.
- DEF-028 and DEF-034 are explicitly deferred, not silently skipped --
  substantial net-new subsystems already scoped as their own roadmap phases.
- Not yet re-verified against a live bench run at the time this ADR was
  written -- see the deployment readiness report for the live test result
  once available.
