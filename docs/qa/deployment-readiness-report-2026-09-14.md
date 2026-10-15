# Deployment Readiness Report — Edupro School Fees & Financial Statement System

**System:** `edupro_school_fees` (Frappe v15) + Next.js frontend, `fees.edupro.co.zw`
**Report date:** 2026-09-14
**Round:** 3 — delta against `docs/qa/deployment-readiness-report-2026-09-13.md`
**Audited commit:** `52ae8cc` (HEAD, clean working tree) — pushed and hot-patched live; **not yet baked into a rebuilt Docker image** (see §3)
**Auditor:** Claude (Sonnet 5)
**Scope:** Functional/backend/data-model/RBAC/compliance/security testing only, per this round's brief. Frontend design, styling, and UX are explicitly out of scope (covered separately).

---

## 1. Executive Summary

**Overall Verdict: ⚠️ READY WITH CONDITIONS — the conditions changed this round.**

**Go/No-Go Recommendation: CONDITIONAL GO**, gated on closing two new items
found this round rather than the procedural items Round 2 was waiting on.

Round 2's two blocking conditions — complete the rebuild/redeploy cycle, and
run a live smoke test against the real rebuilt image — are both **done**
this round. The rebuild surfaced and closed one infrastructure bug (a
Traefik routing rule matching `/applicants` as `/app`). But finishing that
work unlocked something Round 1 and 2 never did: **the first real,
browser-based, logged-in-as-each-role walkthrough of this system in this
project's QA history.** Every previous round's RBAC and workflow verdicts
were based on the automated test suite (`frappe.set_user()`, which
bypasses the actual login/2FA HTTP path) and static code tracing. Actually
logging in surfaced two real defects immediately:

1. **A floating-point precision bug rejected genuinely balanced Journal
   Entries** — found while batch-invoicing real seeded students. Fixed,
   hot-patched, live-verified. See ADR 0027.
2. **Every privileged role was completely locked out of login** — 2FA was
   enabled with no working email delivery configured, so the OTP
   send failed and blocked login with a raw, unhandled error. This had
   been live since Round 1's own DEF-030 fix and was invisible to every
   prior round because none of them performed a real login. **Currently
   mitigated by disabling 2FA site-wide, on explicit user authorization,
   as a temporary measure** — production financial accounts currently
   have **no second factor at all**. See ADR 0027.

A third, non-code finding: the production database is not clean. It
carries roughly 239 Students, 140 Invoices, 27 Receipts, 167 Journal
Entries, and over 100 `Batch Test Structure...` Fee Structures — all
synthetic fixtures accumulated by four rounds of `bench run-tests` running
against the live site (a standing, documented characteristic of this
project — there is no throwaway test database). This is now visible to
real users: a live School Head dashboard this round showed dozens of these
test fixtures in its Fee Structures list, alongside genuine QA data.

**Justification for CONDITIONAL GO rather than NO-GO:** neither new defect
reflects a design flaw in the core financial engine. The floating-point fix
is a one-line, root-caused, tested fix already live. The 2FA lockout is a
configuration gap (no outgoing email account) with a clear, bounded fix
that does not require a code change. Everything this round *did* manage to
verify live — Bursar, School Head, SDC Chairperson/Treasurer, and District
Auditor dashboards; server-side fund segregation (SDC's own API queries for
Fund A data return empty); write-blocking for a read-only role (403 on a
District Auditor attempting to post a Journal Entry); the absence of any
arrears-blocks-access or public-defaulters-list feature (see §6) — passed
cleanly. The system's financial logic is sound. What is not yet true is
that a real user can reliably reach it.

---

## 2. What Changed Since Round 2

### 2.1 Round 2's blocking conditions — closed

| Round 2 condition | Status |
|---|---|
| Rebuild both Docker images from scratch | ✅ Done — backend and frontend images rebuilt, verified image hash matches running container |
| Redeploy against the rebuilt images | ✅ Done — `docker compose up -d --force-recreate` (backend), controlled recreate (frontend) |
| Full test suite against the truly rebuilt image | ✅ **219/219 passing** |
| One live smoke-test pass | ✅ Done — found and fixed a real bug (below) |

### 2.2 Real bug found during the rebuild/redeploy smoke test

**Traefik `PathPrefix` naive string matching.** The Frappe backend router
rule used `PathPrefix(\`/app\`)`, `PathPrefix(\`/api\`)`, etc. Traefik's
`PathPrefix` does a raw string-prefix check with no path-segment boundary —
so `/applicants`, `/app-store`, or any path merely *starting with* `/app`
silently matched and was routed to the Frappe backend instead of the
Next.js frontend that should have served it. Fixed by replacing every
`PathPrefix(\`/x\`)` with `(Path(\`/x\`) || PathPrefix(\`/x/\`))` for all
six prefixes (`/app`, `/api`, `/assets`, `/files`, `/private`,
`/socket.io`). This is infrastructure config (`docker-compose.yml` on the
VPS host, not in this repo); a timestamped backup was taken before editing.
Verified via a subsequent unauthenticated request to `/app/logout`
correctly returning Frappe's "Not Permitted" (confirming both the
Desk-lockdown architecture and this routing fix work together correctly).

### 2.3 Real bugs found during this round's own live RBAC verification

See ADR 0027 for full detail on both:

1. **DEF-QA3-001 — floating-point JE validation** (S3, fixed, hot-patched,
   live-verified via `retry_invoice.py`: 0 failures on the 8 previously-
   failing invoices). The regression test is committed
   (`test_journal_entry.py`) but **not yet hot-patched into the live
   container** — only the `.py` fix itself was; the live 219-count does not
   yet include this new test.
2. **DEF-QA3-002 — site-wide 2FA login lockout for every privileged role**
   (S1 — a live, user-facing, total-functionality-blocking defect,
   currently mitigated, not closed; production presently has no 2FA at
   all). Recommended fix: configure a real outgoing `Email Account` with
   `default_outgoing = 1`, re-enable `enable_two_factor_auth`, then
   live-verify the complete OTP login flow for every 2FA-gated role before
   any pilot.

### 2.4 New finding: production database is not clean

Not a code defect — an operational-readiness gap directly relevant to this
report's own "pilot school data migrates cleanly" criterion. A direct SQL
count against the live site, taken at the start of this round, showed:

| Table | Count |
|---|---|
| Student | 239 |
| Invoice | 140 |
| Receipt | 27 |
| Journal Entry | 167 |
| Academic Year | 105 |
| Fee Structure | 106 |

School Setup itself was still literally named `PLACEHOLDER` until filled
in for this round's seeding. This is the direct, cumulative result of
`bench run-tests` running against the live production database across all
three QA rounds (a standing, documented project characteristic — see prior
rounds' reports) rather than an isolated test database. Genuine QA seed
data (the named students, School Setup as "Mbare High School", the named
budget vote lines) was successfully layered on top and did not collide
with the clutter, but a live School Head dashboard this round rendered
dozens of `Batch Test Structure...` entries in its Fee Structures list
alongside real data — a real user would see this.

**Recommendation:** the production database must be reset/purged of all
test-suite-generated data before any real pilot school's data is loaded.
Separately, the project should move to a throwaway/ephemeral test database
for all future `bench run-tests` invocations so this does not recur.

### 2.5 Minor UX/session-state observation (not scored — flagged for the separate frontend review)

After calling the logout API, the frontend continued rendering the
previous role's cached dashboard content until an explicit full navigation
reload. The underlying session was correctly invalidated server-side
throughout (confirmed: a direct API call after logout correctly returned
`PermissionError` for a whitelisted-only method, and session cookies
correctly showed `user_id=Guest`) — this is a client-side rendering/cache
staleness issue, not a security bypass, since every actual data-bearing API
call remains properly session-gated. Logged here for completeness; scoring
belongs to the separate design/UX review this round explicitly excludes.

---

## 3. Live RBAC Verification (new this round — see §1)

This is the first round with real, browser-based, logged-in-as-role
evidence rather than automated-suite-only evidence. Covered this round:
Bursar, School Head, SDC Chairperson/Treasurer, District Education
Auditor/Inspector. Not reached live this round (automated-suite evidence
only — see §4): Parent/Guardian, Student, System Administrator.

| Role | Live login | Dashboard correctly scoped | Server-side negative test |
|---|---|---|---|
| Bursar | ✅ (landed on Bursar/Fees-Approver dashboard) | ✅ | — |
| School Head | ✅ | ✅ Read-only Fee Structures correctly captioned "approval is Bursar drafts, Fees Approver signs off"; PV approval queue correctly framed as SDC-already-co-approved | — |
| SDC Chairperson/Treasurer | ✅ | ✅ Only Fund B (SDC-001) vote line visible; PV queue correctly captioned "Fund B (SDC/SDA) only" | ✅ `GET /api/resource/Budget Line?filters=[["fund","=","Fund A"]]` → `200`, `{"data":[]}` — Fund A is server-side filtered out, not just UI-hidden |
| District Education Auditor/Inspector | ✅ | ✅ Read-only, school-wide (both funds visible, correctly labeled "Read-only") | ✅ `POST /api/resource/Journal Entry` → `403 PermissionError` — "does not have doctype access via role permission" |

The District Auditor's live dashboard also independently confirmed
DEF-QA3-001's fix: JE-2026-00171 through -00175 (the 8 previously-failing
QA invoices, ZiG 323.96 each) appear as real, posted, balanced Journal
Entries in the live feed.

---

## 4. Automated Test Suite

**219 of 219 tests passing**, run against the freshly rebuilt production
image this round (unchanged count from Round 2 — the new
`test_balanced_entry_survives_floating_point_summation_artifacts` test is
committed but not yet included in a live run; see §2.3).

RBAC-relevant tests already in this suite and passing, providing coverage
for roles/paths not reached by this round's live browser walkthrough:
`test_system_manager_cannot_issue_receipt`,
`test_system_manager_cannot_create_cashbook_payment_or_purchase_order`,
`test_sdc_only_sees_fund_b_journal_entries`, `test_bursar_sees_both_funds`,
`test_parent_sees_own_family_only`,
`test_student_sees_own_records_only_and_never_receipts`,
`test_payment_plan_visible_only_to_own_guardian`,
`test_internal_roles_unaffected_by_portal_scoping`,
`test_only_school_head_can_approve_reversal`,
`test_fee_structure_visible_only_once_approved`. These are genuine,
passing, automated regression tests and are treated as valid evidence for
their specific claims — but they authenticate via `frappe.set_user()`, not
the real login/2FA HTTP path, which is exactly the blind spot DEF-QA3-002
exposed. **Recommendation for Round 4:** add at least one real
browser-based login test per remaining role (Parent, Student, System
Administrator) before relying on automated-only evidence for those roles
in a final readiness verdict.

---

## 5. Explicit Scope Decision: Performance/Scale Testing

The system was **not** seeded with literal production-scale synthetic data
(300 students, thousands of receipts) against the live production
database this round, by deliberate decision — doing so would permanently
and unnecessarily pollute an already-cluttered live system (§2.4) for no
verification benefit proportionate to the risk. A representative dataset
(10 students, 4 bank accounts' worth of budget vote lines, real governance
workflow) was seeded instead, sufficient to exercise every live
functional/RBAC path above.

**Performance, load, and scalability testing at production scale is marked
BLOCKED for this round.** It requires either a disposable staging
environment seeded at real scale, or a load-testing tool run against a
non-production target — neither was available this round. This is
consistent with prior rounds; it is not a new gap.

---

## 6. Zimbabwe-Specific Compliance — Critical Checks

Both checks explicitly flagged CRITICAL by this round's brief were
verified this round, by code search rather than a live UI probe (no
feature exists to test against):

| Check | Method | Result |
|---|---|---|
| Arrears must never block a student's class or exam access | Searched the full `edupro_school_fees` app for any field, hook, or check linking `Student`/attendance/exam eligibility to `Invoice`/`Receipt` outstanding balance | **PASS by absence** — no such mechanism exists anywhere in the codebase. The system has no way to withhold class or exam access for fee arrears because no such feature was ever built. |
| No public defaulters list may ever be generated | Searched for any report, print format, or API method that lists or publishes named debtors | **PASS by absence** — no such feature exists. The only debtor-facing views found (`Debtor Case`, ageing summaries) are role-gated to Bursar/SDC/School Head/Auditor, never public. |

Both are clean passes. Neither is at risk of regressing unless a future
phase (e.g., Phase 5's Debtor Management per the roadmap) introduces one —
flagging this explicitly so a future round re-checks it if that phase
ships.

---

## 7. Updated Deployment Readiness Assessment

### Green Light Criteria

| Criterion | Round 2 | Round 3 |
|---|---|---|
| Zero S1 defects open | ✅ Yes | ⚠️ **One new S1 found and mitigated, not closed** (DEF-QA3-002 — 2FA disabled site-wide) |
| Zero S2 defects on core finance paths | ✅ Yes | ✅ Yes (DEF-QA3-001 is S3, fixed) |
| All compliance rules verified at code level | ✅ Yes | ✅ Yes, plus the two Zimbabwe-specific critical checks now explicitly re-verified (§6) |
| All RBAC matrix tests pass | ✅ Yes (automated only) | ✅ Yes — automated **and**, for 4 of 7 roles, now live-verified (§3) |
| Audit trail verified immutable | ✅ Yes | ✅ Yes (unchanged) |
| Financial statements balance in both currencies | ✅ Yes | ✅ Yes |
| Trial balance balances | ✅ Yes | ✅ Yes |
| Live automated test suite passes | ✅ 219/219 | ✅ 219/219 (against the truly rebuilt image this time — see §2.1) |
| **Privileged-role login works end-to-end, including 2FA** | ⏸️ Never tested | ❌ **New criterion this round — currently failing.** Login works only because 2FA is temporarily disabled. |
| Offline sync verified with no data loss | ❌ N/A | ❌ N/A — still doesn't exist (unchanged, deferred by design) |
| Pilot school data migrates cleanly | ⏸️ Not tested | ❌ **Newly failing** — production DB is not clean (§2.4); a real pilot's data would land alongside ~239 synthetic students and 100+ test fixtures |

### Red Criteria (any single one triggers NO-GO)

No criterion from Round 1/2's list is currently triggered (no S1 code
defect, no RBAC breach). This round adds one new item to watch, not yet
scored as a Red trigger because it has a bounded, already-understood fix:

- **Privileged accounts currently have no second factor at all.** This is
  a live, accepted-temporary regression in authentication posture (ADR
  0027), not a design flaw — but it must not still be true at pilot
  go-live, or it becomes a Red criterion by this report's own framework
  (an RBAC/security-posture breach, functionally equivalent to "any RBAC
  breach" from Round 1/2's own Red list).

### Final Recommendation

> **CONDITIONAL GO — the core financial engine is sound and, for the first
> time, live-verified through real role-based logins. Three concrete items
> gate a pilot, all already root-caused with clear owners:**
>
> 1. **Configure a real outgoing email account** (`Email Account` with
>    `default_outgoing = 1`), **re-enable `enable_two_factor_auth`**, and
>    live-verify the complete OTP login flow for every 2FA-gated role
>    (Bursar, School Head, SDC Chairperson/Treasurer, System Manager) —
>    not just that login succeeds, but that a real OTP email arrives and
>    is accepted. This closes DEF-QA3-002 for real, rather than leaving 2FA
>    off.
> 2. **Reset/purge the production database** of all `bench run-tests`
>    accumulated fixtures before any real pilot school's data is loaded,
>    and move future test runs to a throwaway database so this cannot
>    recur.
> 3. **One more rebuild → redeploy → full-test-suite cycle**, now that
>    DEF-QA3-001's fix and its regression test are both committed, so the
>    Docker image actually running in production matches everything
>    verified in this report (currently: the fix is hot-patched live, but
>    not yet baked into a rebuilt image, and the new test isn't in the live
>    219 count).
>
> None of these are code-architecture problems. All three are
> operational/procedural steps this project has a proven, repeatable
> process for (this round completed the same class of work for Round 2's
> conditions). Once closed, re-run this round's live RBAC walkthrough for
> the three roles not yet reached (Parent/Guardian, Student, System
> Administrator) to complete the full 7-role matrix live, and this system
> meets every Green Light criterion in this report's own framework.

---

## 8. Sign-Off Block

| Role | Name | Decision | Date | Signature |
|---|---|---|---|---|
| QA Lead | | CONDITIONAL GO (pending 2FA remediation + DB purge + final rebuild cycle) | 2026-09-14 | |
| Product Owner | | | | |
| Development Lead | | | | |
| School Head (Pilot) | | | | |
| SDC Chairperson (Pilot) | | | | |
| Edupro CTO | | | | |

---

## Appendix — Everything from Rounds 1–2 not restated here

Sections unchanged by this round's work are not reproduced — refer to
`docs/qa/deployment-readiness-report-2026-09-12.md` (Round 1) and
`docs/qa/deployment-readiness-report-2026-09-13.md` (Round 2) for: the
full original methodology, the complete defect register with file:line
evidence for all 39 Round 1 defects and their resolutions, "what's working
well," the pilot plan, the risk register, the full RBAC capability grid,
and the statutory report checklist. Every finding recorded there as fixed
remains fixed; nothing in this round's work reopened any prior closed
defect. Offline-resilient architecture (DEF-034), online/mobile payment
initiation (DEF-028), and the WhatsApp channel (DEF-037) remain open,
unchanged, deliberately deferred net-new subsystems — not reassessed this
round, per its functional-testing-of-what-exists scope.
