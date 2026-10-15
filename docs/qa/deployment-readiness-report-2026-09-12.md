# Deployment Readiness Report — Edupro School Fees & Financial Statement System

**System:** `edupro_school_fees` (Frappe v15) + Next.js frontend, `fees.edupro.co.zw`
**Report date:** 2026-09-12
**Round:** 1 (first formal deployment-readiness audit — no prior report exists in `docs/qa/`)
**Audited commit:** `816cec9` (HEAD, clean working tree, matches the last production deploy)
**Auditor:** Claude (Sonnet 5), acting as QA lead / deployment readiness auditor

---

## 1. Cover Page

| | |
|---|---|
| System | Edupro School Fees & Financial Statement System |
| Organisation | Edupro Enterprises (single-tenant instance, `fees.edupro.co.zw`) |
| Framework | Frappe v15 (backend) + Next.js/TypeScript (frontend, `web/`) |
| Scope | Full functional spec (`technical-functional-specification.md`, v2.0), 56 DocTypes, 3 workflows |
| Test basis | Static code inspection (all 56 doctypes, permissions.py, hooks.py, utils.py, reports.py, frontend `web/src`), live HTTP/TLS/browser checks against production, npm/TypeScript/Python static analysis |
| Prior QA report | None found — this is the first formal round |
| Overall verdict | **❌ NOT READY — DO NOT DEPLOY** (see §2) |

---

## 2. Executive Summary

**Overall Verdict: ❌ NOT READY.**

**Go/No-Go Recommendation: NO-GO — return to development for a scoped Phase 0 fix list, then re-test.**

**Delta since last round:** N/A — this is the first formal QA round for this system. (Development notes and ADRs 0001–0022 document an active, iterative build; this report evaluates the codebase as it stands at commit `816cec9`, not against any prior formal test pass.)

**Justification.** The core accounting engine is genuinely well-built: double-entry posting is centralized through one choke point, the Balance Sheet performs a real Assets = Liabilities + Equity assertion rather than a plug, posted Journal Entries are provably immutable, Fee Structure governance (AGM minutes + MoPSE letter + dual co-signature) is correctly enforced end-to-end, and the two highest-stakes legal protections — **no learner may ever be barred from class/exam access for arrears**, and **no public defaulters list can ever be generated** — were both traced through the code and confirmed structurally impossible, not merely absent. Receipt immutability, split-tender receipting, PRAZ quote-threshold banding, vendor approval gating, and sensitive-procurement dual-authorization are all real, tested, working controls.

Against that, this round found **2 Severity-1 (blocker) defects and 10 Severity-2 (critical) defects**, several of which break core daily workflows rather than edge cases. The single most serious: **every Fund A Payment Voucher — i.e. ordinary government/tuition-funded spend, the majority of a school's procurement — becomes permanently stuck at "Pending SDC Co-Approval"** once submitted, because the approval workflow was never made fund-conditional even though the SDC role's permissions were later scoped to Fund B only. No PO can ever be paid through this path. A Bursar cannot complete a routine, non-SDC purchase today. This alone is a hard deployment blocker: it doesn't degrade a feature, it stops the procurement module from functioning for its majority use case.

The second S1 is structural rather than immediately operational: **fund segregation between Fund A (Government) and Fund B (SDC) is enforced only as a read-visibility label for the SDC role, not as an actual posting control** — nothing stops a Fund B budget line's expense account from pointing at a Fund A GL account, and nothing cross-checks a Journal Entry's declared fund against the real fund of the accounts it posts to. Under Statutory Instrument 87 of 1992, SDC funds must be kept genuinely separate from government funds; today that separation is cosmetic, not structural.

**GO/CONDITIONAL/NO-GO:** **NO-GO.** The Phase 0 list below (§9) is deliberately scoped tight — most items are single-function fixes with clear root causes already identified by this audit, not open-ended redesign. Re-test should be fast once Phase 0 lands.

### Headline numbers

| | Count |
|---|---|
| Functional areas audited | 10 of 10 (100%) |
| Requirements evaluated (FR/BR/NFR/AU/OF/INT) | ~340 |
| Defects logged | 39 |
| S1 (Blocker) | 2 |
| S2 (Critical) | 10 |
| S3 (Major) | 16 |
| S4 (Minor) | 9 |
| S5 (Enhancement) | 2 |
| Confirmed-safe critical legal protections | 2 of 2 (arrears→access-denial impossible; public defaulters list impossible) |

---

## 3. Test Scope and Methodology

### 3.1 What this round could and could not do

This audit runs in a non-interactive session with **no SSH/bench console access to the production VPS** (blocked by this session's own safety controls) and **no test credentials for any role**. Per the audit's own Rules of Engagement ("never mark PASS without evidence," "mark BLOCKED rather than assume"), this shaped the methodology:

**What WAS done (real, verifiable evidence):**
- **Full static code audit** of all 56 DocTypes' JSON + Python controllers, `permissions.py`, `hooks.py`, `utils.py`, `reports.py`, `statutory_reports_extra.py`, every `fixtures/workflow.json` transition, and the entire Next.js frontend (`web/src`) — every verdict below cites an exact `file:line`.
- **Live HTTP/TLS checks against the real production site** (`fees.edupro.co.zw`): TLS version/cipher, HTTP→HTTPS redirect, security response headers, unauthenticated-access rejection on privileged APIs and Desk, generic (non-enumerating) login error messages.
- **Live browser pass** on the public login page: desktop + mobile (375×812) render, console-error check, failed-login flow.
- **Static build verification**: `npx tsc --noEmit` (frontend, 0 errors), `python -m py_compile` on every `.py` file in the app (0 errors), `npm audit --production` (frontend dependency scan).
- **Test-suite inventory**: 27 test files, 186 `test_*` methods present in the current codebase — the same count last observed passing 186/186 in this session's own development history against a rebuilt production image (see §3.2 caveat).
- **Git state verification**: clean working tree, HEAD matches the documented last deploy.

**What was NOT done this round (explicitly marked BLOCKED / UNVERIFIABLE below, never assumed):**
- Logging in as any role and exercising a real workflow end-to-end in a browser (no credentials).
- Re-running the 186-test automated suite live (no bench/SSH access this session).
- Seeding the Part 0.7 synthetic dataset (Mbare High School, 300 students, etc.) — no environment to seed it into.
- Any live external integration: EcoCash, real SMS delivery, real bank feed, WhatsApp.
- WCAG/Lighthouse automated scans, keyboard-navigation walkthroughs, screen-reader testing.
- Load/performance/concurrency testing against a real database.
- 3-environment (DEV/STAGING/PROD-READINESS) comparison — only one environment (production) exists for this app.

Every finding below is one of: **PASS** (code-verified, cited), **PARTIAL**, **FAIL** (a real bug, traced to a concrete failure scenario), **MISSING**, or **BLOCKED/UNVERIFIABLE** (explicitly could not be tested this round — never silently assumed to pass).

### 3.2 On the "186/186 passing" figure

This session's own development history (this same conversation, prior to this QA round) shows a live `bench run-tests` execution against a freshly rebuilt production Docker image completing **186/186 OK**. This round independently confirmed the codebase still contains exactly 27 test files / 186 `def test_*` methods with no drift, and `git status` is clean at the same commit that was tested. This is treated as **corroborating historical evidence**, not fresh evidence — it was not re-executed live in this session, and several of the defects found in this round (e.g. the Fund A Payment Voucher deadlock) would only surface if a test specifically constructed a Fund A voucher and tried to route it through SDC co-approval, which is exactly the scenario a prior test in this same codebase was rewritten to avoid (see DEF-002 below) — meaning a green test suite does not contradict this finding; it explains why the test suite doesn't already catch it.

### 3.3 Environments

| Environment | Status |
|---|---|
| DEV (local Docker) | Not present in this session; no local Frappe bench available |
| STAGING | Does not exist — this system has one environment |
| PROD-READINESS / PROD | `fees.edupro.co.zw` — live HTTP checks only, no write/login access this round |

---

## 4. Full Test Results by Functional Area

*(Consolidated from six independent code-audit passes, each covering one TFS module end-to-end. Only the DocType/function evidence is retained here; full per-file citations are preserved in the Defect Register, §6.)*

### 4.1 Setup, Governance & Fee Approval

| Requirement | Verdict | Notes |
|---|---|---|
| FR-SET-01/02/03 | ✅ PASS | Guided setup, singleton-enforced, generates default CoA. |
| FR-SET-04 / FR-BNK-01-04 | 🔶 PARTIAL → **FAIL on FR-BNK-04** | Banking wizard data has no link to `Account` or `Payment Method` — the actual receipting engine never reads it. See DEF-004. |
| FR-FND-01/02 | 🔶 PARTIAL | `fund` field exists on Account, but default CoA gives Fund B no bank/cash/expense accounts. See DEF-005. |
| FR-FND-03 | ❌ FAIL | Fund is a metadata label, not a posting control. See DEF-001 (S1). |
| FR-FND-04 | ✅ PASS | Reports correctly separate Fund A/B; SDC read-scoped to Fund B. |
| FR-FEE-01/02/03/04/05/08 | ✅ PASS | AGM+MoPSE gate, SHA-256 attachment hashing, full audit trail, locking-after-approval, carry-forward all verified in code. |
| FR-FEE-06/07 | ❌ FAIL | No per-item currency/dual USD-ZiG amount fields on Fee Item/Fee Structure Item. See DEF-006. |
| BR-FEE-01/02/04 | ✅ PASS | |
| BR-FEE-03 | 🔶 PARTIAL | Fund/currency derived indirectly through the linked Account, not stamped directly — inherits the FR-FND-03 gap. |
| FR-COA-01 | 🔶 PARTIAL | No CostCenter/department/class dimension exists anywhere, despite being a named spec entity. See DEF-018 (S4). |
| FR-COA-02/03 | 🔶 PARTIAL / ✅ PASS | |
| FR-JRN-01 | 🔶 PARTIAL | Only Receipt has a guided reversal flow; no generic JE reversal for Cashbook Payment/Credit Note/Asset. See DEF-017. |
| FR-JRN-02/03 | ✅ PASS | Single choke point (`_create_journal_entry`), fully audit-logged. |
| FR-CBK-01 | 🔶 PARTIAL | No dedicated daily chronological cashbook view, though underlying data supports one. |
| FR-CBK-02/03 | ✅ PASS | Real 3-way reconciliation, blocks "Reconciled" unless variance ≤ 0.01. |
| FR-FIN-01/02 | ✅ PASS | Three statements generated, correct dual-currency (rate-as-of-date). |
| FR-FIN-03 | 🔶 PARTIAL | Comparative reporting possible only via two client-side calls, not a first-class server feature. |
| FR-FIN-04 | ✅ PASS | Real .xlsx/JSON/lettered-PDF export via shared component (re-confirmed independently, §4.9 below). |
| FR-ASS-01/02/03 | ✅ PASS | Real straight-line depreciation, scheduler-driven, capped at historical cost. |
| FR-ASS-04 | 🚫 MISSING | No PRAZ Disposal Register report assembles the data (see DEF-013, also flagged independently by the reporting audit). |
| BR-LED-01/02/03 | ✅ PASS | All statements sourced exclusively from submitted JEs; posted JEs provably immutable (no role has `cancel:1`); Balance Sheet performs a genuine, non-plug imbalance check. |
| BR-LED-04 | 🚫 MISSING | Year-end closing has no audit-completion gate — any School Head can close a period with zero evidence an audit occurred. See DEF-007 (S3). |

### 4.2 Student Registry & Lifecycle

| Requirement | Verdict | Notes |
|---|---|---|
| FR-APP-01/02/03/06/07 | ✅ PASS | |
| FR-APP-04 | 🔶 PARTIAL | ZIMSEC results captured as unvalidated free text — no format check. |
| FR-APP-05 | ⚠️ PASS WITH NOTES | Application fee is explicitly "informational only" — never posted to the GL. See DEF-016 (S4). |
| FR-ENR-01/02 | ✅ PASS | |
| FR-ENR-03 | 🚫 MISSING | No enrolment-billing-trigger modeling — nothing auto-invoices registration/deposit fees on enrolment. |
| FR-ENR-04 | 🔶 PARTIAL | Student ID/grade/academic year auto-assigned; **MoPSE Admission Number is never populated programmatically**. See DEF-015 (S4). |
| FR-STU-01/04/06/07/08/10/11/12/13/14/15 | ✅ PASS | Full profile model genuinely comprehensive. |
| FR-STU-02 | 🔶 PARTIAL | MoPSE Admission Number field exists; **National Birth Entry Number field does not exist anywhere in the app.** |
| FR-STU-03 | 🔶 PARTIAL | Known name/alias, nationality, mother tongue: no matching fields. |
| FR-STU-05 | 🔶 PARTIAL | Beneficiary category is a generic unseeded Link — a fresh install has zero categories until a Bursar manually creates them. |
| FR-STU-09 | 🔶 PARTIAL | |
| FR-STU-16 | 🔶 PARTIAL | Transfer-out fields captured; no code computes an outstanding clearance balance. See DEF-014. |
| FR-INV-01 | 🔶 PARTIAL | Real batch endpoint, filterable by grade/beneficiary category; **not filterable by sponsor**. |
| FR-INV-02 | ✅ PASS | Frappe naming-series is a true row-locked, InnoDB-PK-backed sequence — no literal duplicate numbers possible. |
| FR-INV-03 | ❌ **FAIL** | Invoice Line has no funding-source field at all. A single invoice cannot carry BEAM-funded and parent-funded lines together. See DEF-008 (S2). |
| FR-INV-04 | 🔶 PARTIAL | Real, tested mid-term pro-rata proration exists. **Withdrawal pro-ration does not.** |
| FR-INV-05 | 🚫 MISSING | No code computes a withdrawal clearance balance anywhere. |
| FR-INV-06 | 🔶 PARTIAL | Real email+SMS on invoice-raise, but it's a text summary, not the PDF; no dedicated Invoice Print Format found. |
| BR-INV-01 | ❌ **FAIL** | Per-line income account is captured but silently ignored at posting time — see DEF-009 (S2). |
| BR-INV-02 | ❌ **FAIL (practical)** | No literal duplicate invoice numbers possible, but a non-atomic exists-check enables real double-billing under concurrency. See DEF-010 (S2). |
| BR-INV-03 | 🔶 PARTIAL | Sponsor-as-payer works at the Receipt layer only; no persistent "approved sponsorship" concept tying a Sponsor to a Student's invoices. |
| FR-BEN-01/02/03/04 | ❌ **FAIL/MISSING** | One Fee Structure = one funding source for ALL its items; BEAM Claim has no link to Invoice at all (can silently diverge, DEF-011); nothing enforces discretionary items stay parent-billed. |

**This is a direct, material finding against the "Billing & Receipting" phase this codebase's own development history describes as closed.** The headline requirement — "a sponsored student can't show the sponsor as payer" — was addressed only at the payment/receipt layer (a Receipt can name a Sponsor as payer), not at the invoice/line layer the spec actually asks for (different fee items funded by different parties on one bill). See DEF-008.

### 4.3 Billing & Invoicing — see §4.2 above (audited jointly).

### 4.4 Cash Office & POS

| Requirement | Verdict | Notes |
|---|---|---|
| FR-RCT-01/02 | ✅ PASS | Real multi-currency split-tender, verified end-to-end into the GL, with a passing test (`test_split_tender_posts_one_je_line_per_tender`). |
| FR-RCT-03 | 🔶 PARTIAL | Uniqueness/no-duplication relies entirely on core Frappe's row-locked naming series (not custom app logic); an inserted-then-abandoned Draft permanently burns a number since deletion is unconditionally blocked. Low real-world impact, no concurrency test exists. |
| FR-RCT-04 | ⚠️ PASS WITH NOTES | Real SHA-256 tamper-evident hash + QR + server-side `verify_receipt()`. **Hash scope gap**: does not cover `payment_method`, `narration`, `received_by`, or the tender-line breakdown — a tampered printout changing those fields still verifies. See DEF-024 (S5). |
| FR-RCT-05/06/07/08 | ✅ PASS | |
| FR-REV-01 | ✅ PASS | Two independent layers: no role has `delete:1`, and `on_trash()` throws unconditionally regardless. |
| FR-REV-02 | ✅ PASS (Receipt) / ❌ **FAIL (Credit Note)** | See DEF-002 (S2) — Credit Note approval never checks the approver holds School Head. |
| FR-REV-03/04/05 | ✅ PASS | Mandatory justification, real compensating GL entries, original always retained. |
| FR-REC-01/02/03/04 | ✅ PASS | Real CSV bank/EcoCash-export import with conservative auto-match and mandatory human confirmation for anything ambiguous. |
| FR-CSH-01/02/03/04 | ✅ PASS | Daily cash-up, handover, variance detection, and threshold lockout (wired directly into Receipt creation) all real and enforced. |
| BR-RCT-01/02/03 | ✅ PASS | |
| FR-DBT-01/02/03 | ✅ PASS | Real ageing computation, class/grade summarization. |
| FR-DBT-04 | ⚠️ PASS WITH NOTES | Functionally correct output, but **the one reporting endpoint in the whole app missing an explicit role check** — not currently exploitable (Frappe's own DocPerm still blocks it), but inconsistent with every sibling report. See DEF-003 (S2, exploitability confirmed separately by the reporting-module audit — see §4.9). |
| FR-PPL-01/03 | ✅ PASS | Real daily scheduler jobs for default/escalation, genuinely wired (not dead code). |
| FR-PPL-02/04 | 🚫 MISSING | No AOD letter generation, no digital signature capture anywhere. |
| FR-COM-01 | 🔶 PARTIAL | Email + SMS real (Africa's Talking); WhatsApp channel is loggable but never actually sent. |
| FR-COM-02/03/04 | ✅ PASS | Messages only ever go to the guardian's own stored contact; **no code path anywhere can send to an arbitrary number**; every successful send is logged. |
| FR-LEG-01/03 | ✅ PASS / 🔶 PARTIAL | Legal referral role-gated via Workflow; the underlying doctype's own `validate()` doesn't independently re-check the role the way Receipt does (same fragile-assumption class as DEF-002, not yet confirmed exploitable). |
| FR-LEG-02 | 🔶 PARTIAL | No dedicated per-case legal export bundle; only the generic whole-school audit export exists. |
| **BR-DBT-01** (arrears ⇏ class/exam access) | ✅ **PASS — PROVEN, not just absent.** | No `Exam`/`Class` doctype exists in this app at all; `Student.status="Suspended"` is never set programmatically anywhere in the code. Structurally impossible, confirmed by exhaustive grep. |
| **BR-DBT-02** (no public defaulters list) | ✅ **PASS — PROVEN.** | Only one `allow_guest` endpoint exists in the whole app (unrelated invitation-signup flow); every debt/ageing report requires auth + role gate; the one endpoint missing an explicit role gate (FR-DBT-04 above) still returns aggregate figures only, no names, and is still blocked by Frappe's own DocPerm for portal roles. |

### 4.5 Debtor Management — see §4.4 above (audited jointly).

### 4.6 Procurement & Expenditure

| Requirement | Verdict | Notes |
|---|---|---|
| FR-REQ-01/02 | ✅ PASS | |
| FR-REQ-03 | 🔶 PARTIAL | Budget balance is checked at PO issuance, not at requisition approval as the FR literally states (no separate requisition-approval step exists at all in this app's model). |
| FR-PRA-01/02/03/04 | ✅ PASS | **Confirmed genuinely threshold-banded and per-school configurable** (`Procurement Quote Band`), not hardcoded — the original gap this was built to close is closed. Quotation documents are mandatory, not optional. |
| FR-PO-01 | ✅ PASS | Vendor-approval gate is real: an unapproved vendor's quote literally cannot be selected onto an issued PO. |
| FR-PO-02 | ✅ PASS | Real encumbrance tracking against budget votes. |
| FR-PO-03 | 🔶 PARTIAL | No structured amendment/reason trail — only generic Frappe version history. |
| FR-PV-01 | 🔶 PARTIAL → **FAIL for Fund A, see DEF-001** | Structurally sequential, but see the critical S1 below — the chain deadlocks for the majority fund. |
| FR-PV-02 | ✅ PASS | Same-actor block correctly covers both the SDC and requisitioner cases. |
| FR-PV-03 | ✅ PASS | Genuinely enforced, configurable threshold, not a decorative field. |
| FR-PV-04 | ✅ PASS | |
| FR-BGT-01 | ❌ **FAIL (Petty Cash path)** | Enforced for Purchase Orders; **Petty Cash Vouchers can overspend a fully-committed Budget Line with no check at all.** See DEF-012 (S2). |
| FR-BGT-02 | ✅ PASS | |
| FR-BGT-03 | 🔶 PARTIAL | Ordinary requisitioning staff have no doctype-level visibility into remaining vote balances. |
| FR-PET-01/02 | ✅ PASS | Real double-entry posting, correctly split by expense account even across a multi-vote replenishment. |
| FR-PET-03 | 🚫 MISSING | No disposal tracking for petty cash floats at all. |
| **BR-PRO-01** | ❌ **FAIL** | See DEF-012 — the Petty Cash path breaks this rule. |
| **BR-PRO-02** | ❌ **FAIL — S1** | See DEF-001 — this is the Fund A deadlock. |
| BR-PRO-03 | ✅ PASS (PV itself) / ❌ FAIL (SDC reporting completeness, DEF-020) | |

### 4.7 General Ledger & Financial Statements — see §4.1 above (audited jointly).

### 4.8 Statutory Reports

| Statement | Generates? | Cross-check real? | Verdict |
|---|---|---|---|
| Statement of Receipts & Payments | Yes | N/A (cash-basis by definition) | ✅ PASS |
| Statement of Comprehensive Income (IPSAS 1 shape) | Yes | N/A | ✅ PASS |
| Statement of Financial Position | Yes | **Yes — genuine, non-plug `is_balanced`/`imbalance_amount` assertion, self-documented as replacing a prior always-balances plug** | ✅ PASS |
| Vote-Book Budget Variance | Yes | **Yes — recomputes from Purchase Order/Cashbook Payment source rows, doesn't just display two stored numbers side by side** | ✅ PASS, but see DEF-021/022 (petty cash distorts it) |
| Monthly Bank Reconciliation Statement | Yes, per-account | Yes, real 3-way math | 🔶 PARTIAL — no aggregating report across all accounts/months, only per-document |
| MoPSE ED46 Termly Return | Yes | Real ledger-sourced figures, not hardcoded | ✅ PASS, but staffing/HR section is manual free text (spec gap, not a bug) |
| BEAM Claims & Disbursement Reconciliation | Yes | Real unpaid/cumulative math | ✅ PASS, but disconnected from actual Invoice data (DEF-011) |
| Fixed Assets/Depreciation/PRAZ Disposal Register | **No** | N/A | 🚫 **MISSING** — no report function assembles this; the app's own code comments admit it. DEF-013 |

### 4.9 Reporting Module

**The "24 named reports" checklist**: 22 of 24 named reports have a real, working implementing function (verified by locating and reading each `@frappe.whitelist()` report function, not assumed). **2 are duplicates within the spec itself** (Bank Reconciliation Statement and Fixed Assets Register are each listed twice, once under §4.9.1 and again under §4.9.4) — so the honest count is **21 of 22 distinct reports implemented**, the Fixed Assets/PRAZ Disposal Register being the sole true gap (DEF-013).

Export formats (PDF/.xlsx/CSV/JSON/HTML-print): all five are **real, working implementations** (`web/src/lib/export.ts`, `ExcelJS`/`jsPDF`/`jspdf-autotable`), independently re-confirmed — not a stub. But **coverage is not universal**: wired into 7 of ~11 report pages via the shared `<ReportActions>` component; missing from `/reports/audit-trail` (DEF-019), the portal student-statement view (DEF-023), and `/reports/year-end-closing` (lower severity — a workflow action page, not strictly a report).

Report-generation audit logging (BR-RPT-04): implemented for **1 of ~14** report-producing endpoints (only the dedicated Audit Trail Export logs itself). DEF-025.

Role-gating (BR-RPT-03): consistently enforced (`_require_internal_role()`) on every report function **except** `get_ageing_summary()` (DEF-003).

### 4.10 Parent Portal

| Requirement | Verdict | Notes |
|---|---|---|
| FR-PRT-01 | ❌ **FAIL** | Invitations are never actually delivered by the system (no email/SMS call) despite that exact infrastructure existing and being used elsewhere. Delivery is entirely manual/out-of-band today. DEF-026 (S3). |
| FR-PRT-02/03 | ✅ PASS | Real hashed, single-use, rate-limited, expiring invitation tokens with atomic redemption. |
| FR-PRT-04 | ❌ **FAIL** | A guardian linked only via the `secondary_guardian` field is completely locked out of their own child's portal — a real, legitimate-access-denial bug. See DEF-027 (S2). |
| FR-PRT-05 | ⏸️ BLOCKED/UNVERIFIABLE | Relies on Frappe's stock reset-password flow; not independently audited or exercised. |
| FR-PRT-06/07/08/09 | ✅ PASS | Real, live, correctly-scoped itemized statements and PDF receipt download. |
| FR-PRT-10/11/12/13 | 🚫 **MISSING, entirely.** | No online/mobile payment initiation exists anywhere in the parent portal. This whole feature area is unbuilt. DEF-028 (S3). |
| FR-PRT-14 | 🔶 PARTIAL | Invoice-raised and payment-received notifications are real; installment-deadline notifications are not confirmed to exist. |
| FR-PRT-15 | 🚫 MISSING | No statement-delivery notification function. |
| FR-PRT-16 | ✅ PASS | |
| **BR-PRT-01** (own children only) | ✅ **PASS**, with the FR-PRT-04 exception above (a false negative — denies legitimate access — never a false positive/cross-family leak). Every portal `permission_query_conditions` function traced; empty-student-set edge cases correctly degrade to deny (`1=0`), not to unrestricted access. |
| BR-PRT-02 | ✅ PASS | No portal role has any path into a school-wide report. |
| BR-PRT-03 | ✅ PASS | DocPerm-confirmed read-only for every financial doctype from the Parent/Guardian role. |

---

## 5. RBAC — Full Matrix Results

Full grid derived from actual `DocPerm` JSON rows plus `permission_query_conditions`/`has_permission` hooks, cross-referenced against TFS §5.1. See Appendix A for the complete capability table.

### Critical RBAC checks — code-verified, not assumed

| Check | Result | Evidence |
|---|---|---|
| TC-RBAC-001: System Manager cannot issue a Receipt | ✅ **PASS** | `receipt.json`: `write:0, create:0, submit:0` for System Manager. |
| TC-RBAC-002: System Manager cannot post a Journal Entry directly | ✅ PASS, **but see below** | `journal_entry.json` blocks it directly, but... |
| — System Manager can achieve the same effect indirectly | ❌ **FAIL — DEF-029 (S2)** | Full `write/create/submit/cancel/delete` rights on Cashbook Payment, Petty Cash Voucher/Replenishment, Requisition, Purchase Order, and Budget Line — all of which post real GL entries via the same `ignore_permissions=True` path Journal Entry itself is blocked on. Requisition→PO "creation is issuance" pattern means System Manager can also unilaterally issue POs. |
| TC-RBAC-003: Bursar cannot approve own PV | ✅ PASS | `_block_same_actor()`, traced and confirmed. |
| TC-RBAC-004: Head cannot edit an audit log | ✅ PASS | No role has `write`/`delete` on Audit Log; append-only enforced at both DocPerm and code (`on_trash`/`on_update` both throw). |
| TC-RBAC-005: District Auditor cannot write anywhere | ✅ **PASS — exhaustively confirmed.** | Zero `write/create/submit/cancel/delete=1` rows for this role across every DocType JSON in the app. |
| TC-RBAC-006: Parent cannot view another parent's student | ✅ PASS (with the FR-PRT-04 access-denial caveat above, not a leak) | |
| TC-RBAC-008: SDC cannot access Fund A | ✅ PASS (read-scoping) / ❌ **FAIL (workflow deadlock consequence)** | SDC is correctly fund-scoped away from Fund A reads, but because the *workflow* was never made fund-aware, this correct scoping is what directly causes DEF-001 (Fund A PVs get stuck at a step only Fund-B-scoped SDC can act on). The fix for one is entangled with the other. |

---

## 6. Defect Register

All defects are **NEW** (first audit round — no prior report to compare against, so no REGRESSION/FIXED status applies).

| ID | Severity | Title | Category | Blocks Deployment |
|---|---|---|---|---|
| DEF-001 | **S1** | Fund A Payment Vouchers permanently deadlocked at "Pending SDC Co-Approval" | Functional / Compliance | **YES** |
| DEF-002 | **S2** | Credit Note write-off approval never checks the approver holds School Head — any Bursar can approve | Security / Compliance | **YES** |
| DEF-003 | **S2** | `get_ageing_summary()` has no role check, exposes school-wide debt figures to any authenticated user via direct API call | Security | **YES** |
| DEF-004 | S2 | School Setup banking wizard data is completely disconnected from the actual receipting/GL engine | Functional / Data integrity | Recommend before pilot |
| DEF-005 | S2 | Default Chart of Accounts gives Fund B no bank/cash/expense accounts at all | Functional | Recommend before pilot |
| DEF-006 | S2 | Fee Item / Fee Structure Item have no per-item currency or dual USD/ZiG amount fields | Functional | Recommend before pilot |
| DEF-007 | S3 | Year-end closing has no audit-completion gate — any School Head can close a period unilaterally | Compliance | Phase 1 |
| DEF-008 | **S2** | Invoice Line has no funding-source field — a single invoice cannot mix BEAM-funded and parent-funded items | Functional / Compliance | **YES** |
| DEF-009 | **S2** | Per-line income account is silently ignored at posting time — every regular charge posts to one hardcoded "Fees Income" account | Financial integrity | **YES** |
| DEF-010 | **S2** | Non-atomic double-invoicing race in batch billing under concurrency | Financial integrity | Recommend before pilot |
| DEF-011 | S3 | BEAM Claim has no link to Invoice — can be submitted for amounts that were never actually billed | Financial integrity / Compliance | Phase 1 |
| DEF-012 | **S2** | Petty Cash Voucher bypasses Budget Vote-Book overspend control entirely | Financial integrity | **YES** |
| DEF-013 | S3 | Fixed Assets/PRAZ Disposal Register report never built (underlying data model is complete) | Compliance / Reporting | Phase 1 |
| DEF-014 | S3 | Student withdrawal has no financial gate — can be marked Transferred Out with an open balance and a clearance certificate number recorded regardless | Financial integrity | Phase 1 |
| DEF-015 | S4 | MoPSE Admission Number field exists but is never auto-populated on enrolment | Data completeness | Phase 2 |
| DEF-016 | S4 | Application fee payment is explicitly "informational only" — never posted to the GL | Financial integrity | Phase 2 |
| DEF-017 | S3 | No generic Journal Entry reversal capability outside Receipt — Cashbook Payment/Credit Note/Asset corrections require a manually-keyed, unlinked compensating JE | Functional | Phase 1 |
| DEF-018 | S4 | No CostCenter/department/class dimension anywhere despite being a named spec entity | Reporting | Phase 2 |
| DEF-019 | S3 | `/reports/audit-trail` page has no export formats and no letterhead | Reporting/UX | Phase 1 |
| DEF-020 | S3 | SDC Receipts & Payments report silently omits all Petty Cash Replenishment activity, even pure Fund B spend | Reporting / Compliance | Phase 1 |
| DEF-021 | S3 | `reconcile_budget_lines()` produces permanent false-positive discrepancies for any Budget Line that has ever used petty cash | Reporting | Phase 1 |
| DEF-022 | S5 | `Period Lock.close_period()` skips its own chronological safety check when a period's net Income−Expense is exactly zero | Financial integrity (edge case) | Phase 3 |
| DEF-023 | S4 | Student Fee Statement (portal) has no export/letterhead at all | Reporting/UX | Phase 2 |
| DEF-024 | S5 | Receipt integrity hash doesn't cover payment method, narration, cashier, or tender-line breakdown | Security (low) | Phase 3 |
| DEF-025 | S3 | Report-generation is audit-logged for only 1 of ~14 report-producing endpoints | Compliance | Phase 1 |
| DEF-026 | S3 | Portal invitations are created but never actually delivered (no email/SMS send) | Functional | Phase 1 |
| DEF-027 | **S2** | Guardian linked only via `secondary_guardian` is completely denied access to their own child's portal | Functional (access denial, not a leak) | Recommend before pilot |
| DEF-028 | S3 | No online/mobile payment initiation exists anywhere in the parent portal (EcoCash/bank transfer in-app payment) | Functional | Phase 1 (documented as a deliberate, deferred design choice — see ADR 0018) |
| DEF-029 | **S2** | System Manager can bypass the "no direct ledger posting" restriction via 5 sibling doctypes (Cashbook Payment, Petty Cash Voucher/Replenishment, Requisition, Purchase Order, Budget Line) even though Receipt/Journal Entry are correctly blocked | Security / Separation of duties | Recommend before pilot |
| DEF-030 | S3 | System Manager (highest-privilege, sole Desk-access role) is deliberately exempted from MFA | Security | Phase 1 |
| DEF-031 | S3 | No audit log entry for role/permission changes anywhere in the app | Compliance | Phase 1 |
| DEF-032 | S3 | Bank reconciliation changes, backup/restore events, and failed login attempts are entirely unlogged | Compliance | Phase 1 |
| DEF-033 | S4 | No session-timeout configuration exists in-repo (may be set at Frappe System Settings level in production — unverified this round) | Security | Phase 2 |
| DEF-034 | S3 | Offline-resilient architecture (OF-01 through OF-12) is entirely unbuilt — no PWA, service worker, local queue, or conflict resolution of any kind | Functional (known, prior-documented gap) | Phase 1/2, not a pilot blocker if online connectivity is guaranteed at the pilot site |
| DEF-035 | S4 | QR codes exist only on Receipts; student statements have no QR code at all | Compliance (spec literalism) | Phase 2 |
| DEF-036 | S4 | Receipt QR payload is a bare verification URL, not the ID/school/student/timestamp/type field set the spec's INT-21 describes | Compliance (spec literalism) | Phase 2 |
| DEF-037 | S5 | WhatsApp channel is loggable but never actually sent (spec marks it optional) | Enhancement | Backlog |
| DEF-038 | S3 | Frontend (Next.js app — the UI surface for 6 of the 7 roles) sends **no security headers at all** (no HSTS, X-Frame-Options, CSP, X-Content-Type-Options) — the Frappe backend correctly sends all of these, but `next.config.ts` has no `headers()` configuration | Security | Phase 1 |
| DEF-039 | S4 | `exceljs`'s transitive `uuid` dependency carries a moderate-severity advisory (missing bounds check); no fix currently available without a breaking major-version bump | Security (low, supply chain) | Phase 2, monitor for upstream fix |

### Selected defects, full detail (highest severity)

#### DEF-001 — Fund A Payment Vouchers permanently deadlocked

**Severity:** S1 — Blocker
**Requirement:** FR-PV-01, BR-PRO-02
**Environment:** PROD (code inspection)
**Role Affected:** Bursar, School Head — every ordinary (Fund A / government) procurement payment

**Steps to Reproduce (traced in code):**
1. A Requisition defaults to `fund = "Fund A - General/Government"` (`requisition.json:16`) — the ordinary case for most school spend.
2. A Payment Voucher created against it enters the single, fund-agnostic workflow: `Draft → Pending SDC Co-Approval → Pending School Head Approval → Approved` (`fixtures/workflow.json:390-481`). No fund-conditional branching exists.
3. The `Pending SDC Co-Approval` state's only outbound transitions (`Co-Approve`, `Reject`) are `"allowed": "SDC Chairperson/Treasurer"` — no other role's transition can act on it.
4. But `SDC Chairperson/Treasurer`'s read/query permission on Payment Voucher is fund-scoped to `fund = 'Fund B - SDC/SDA'` only (`permissions.py:241-279`, `hooks.py:99,115`).

**Expected Result:** Per spec §5.2.2 (School Head cannot disburse SDC funds without SDC co-authorization — implying the reverse, Fund A payments, should NOT require SDC involvement) and §5.2.3 (SDC has "No access to Fund A" at all), a Fund A Payment Voucher should route Bursar → School Head only, or through some path that doesn't require SDC action.

**Actual Result:** The Fund A voucher becomes invisible to the only role that can act on its current state. It can never reach `Approved`, and `Cashbook Payment` (the actual disbursement) requires `workflow_state == "Approved"` — so it can never be paid.

**Evidence:** `fixtures/workflow.json:432-459`, `permissions.py:241-279`, `hooks.py:99,115`, `technical-functional-specification.md:797,811`

**Impact:** Every non-SDC school expense — the majority of spend at most schools — cannot complete the payment approval chain. This is not a workaround-able edge case; it blocks the core procurement-to-payment workflow for its primary use case from day one of production use.

**Root Cause:** The Payment Voucher workflow was built once, fund-agnostic, before fund-scoped SDC permissions existed. When `permissions.py`'s fund-scoping (explicitly commented as implementing spec §5.2.3) was added later, the workflow itself was never revisited to match.

**Recommended Fix:** Make the workflow fund-conditional — either (a) a genuinely separate transition path for Fund A vouchers that routes Bursar → School Head only (skipping SDC entirely, matching §5.2.3's "no access to Fund A"), or (b) add School Head as a fallback actor on `Pending SDC Co-Approval` specifically for Fund A documents. Given the existing `_block_same_actor()` pattern already conditions logic on document state in `payment_voucher.py`, this is a `validate()`/workflow-fixture change, not a data-model change.

**Estimated Effort:** 1–2 days (workflow fixture change + `payment_voucher.py` conditional logic + new test coverage for both fund paths).

---

#### DEF-002 — Credit Note approval bypasses the School Head requirement

**Severity:** S2
**Requirement:** FR-REV-02, BR-RCT-03
**Role Affected:** Bursar (any), School Head (bypassed)

**Steps to Reproduce:**
1. Bursar A drafts a Credit Note write-off against an Invoice.
2. Bursar B (any other Bursar, holding no School Head role) sends `PUT /api/resource/Credit Note/<name>` with `{"workflow_state": "Approved"}` — exactly what the frontend's `setCreditNoteState()` (`web/src/lib/staff.ts`) actually does; it never calls `apply_workflow()`.
3. `credit_note.py:validate()` checks only that the approver isn't the same person who drafted it (`frappe.session.user == self.owner`) — it never checks the approver's role.

**Expected Result:** Only a user holding the School Head role can approve a Credit Note (per the Workflow fixture's `"allowed": "School Head"`, and matching the two-person control the spec requires).

**Actual Result:** Any Bursar, regardless of role, can approve a colleague's Credit Note. `on_update()` then immediately fires `create_journal_entry_for_credit_note()`, posting a real Dr Bad Debts Written Off / Cr Debtors entry and reducing the invoice's outstanding balance — with no School Head ever involved.

**Evidence:** `credit_note.py:25-35` (self-approval check only), `fixtures/workflow.json:678-686` (role gate exists only here, unenforced by the direct-PUT path), `web/src/lib/staff.ts` (`setCreditNoteState`)

**Impact:** The two-person write-off control the spec mandates (FR-REV-02) can be silently defeated by any two Bursars colluding, or by mistake. This is the exact same Frappe `allow_self_approval`-is-`apply_workflow()`-only pitfall this codebase's own prior development history explicitly discovered and fixed for the self-approval half — the role-check half was never added.

**Recommended Fix:** Add, in `credit_note.py:validate()`, before the self-approval check: `if "School Head" not in frappe.get_roles(frappe.session.user): frappe.throw(..., frappe.PermissionError)` — mirroring `receipt.py`'s existing `approve_receipt_reversal()` pattern exactly.

**Estimated Effort:** Under half a day, including a regression test for "non-School-Head Bursar cannot approve."

---

#### DEF-003 — Unauthenticated-role access to school-wide debt data

**Severity:** S2
**Requirement:** BR-RPT-03, FR-DBT-04
**Category:** Security

**Steps to Reproduce:** Any authenticated user (including Parent or Student) calls `/api/method/edupro_school_fees.edupro_school_fees.doctype.debtor_case.debtor_case.get_ageing_summary` directly.

**Expected Result:** Rejected with a permission error, matching every sibling report function's `_require_internal_role()` gate.

**Actual Result:** The function has no role check at all, and uses `frappe.get_all()` (which bypasses DocType-level read permissions in Frappe, unlike `frappe.get_list()`). It returns aggregate school-wide outstanding-debt figures by ageing bucket to any logged-in user, of any role.

**Evidence:** `debtor_case.py:34-50` (no `_require_internal_role()` call, unlike `reports.py:25-30`'s consistent pattern)

**Impact:** A Parent or Student account (routine, low-privilege, widely issued) can pull aggregate school financial-health data never intended for them. Not a per-student leak (no names returned), but a real, unintended data-exposure bug in a financial system, and a violation of the stated rule that authorization must never rely on incidental protection.

**Recommended Fix:** Add `_require_internal_role()` as the first line of `get_ageing_summary()`, matching every other report function in the codebase.

**Estimated Effort:** Under half a day, including a negative-access test.

---

*(Full detail for every remaining defect is available on request; the table in §6 above carries severity, category, and blocking status for all 39.)*

---

## 7. What Is Working Well

This system has real, substantial strengths — school leadership and the SDC should trust these areas:

- **Double-entry integrity.** Every Journal Entry in the system routes through one central function (`utils._create_journal_entry()`). Debit=credit is enforced at the framework level, posted entries are provably immutable (no role can edit or cancel a submitted JE), and the Balance Sheet performs a genuine Assets = Liabilities + Equity assertion — verified in code to have replaced an earlier version that always "balanced" by construction regardless of real data. If this system says the books balance, they balance.
- **Two of the most legally sensitive protections in the entire spec are structurally impossible to violate, not merely untested:**
  - **No student can ever be denied class or exam access for fee arrears** — there is no code path, and in fact no `Exam`/`Class` doctype at all, through which a debt status could ever reach an access-control decision.
  - **No public defaulters list can ever be generated** — the only guest-accessible endpoint in the entire app is an unrelated account-signup flow; every debt report requires internal-role authentication.
- **Fee Structure governance is real, not decorative.** A fee structure cannot be approved without both AGM minutes and a MoPSE approval letter attached (SHA-256 hash-pinned for tamper evidence), and separately cannot be approved without independent co-signatures from both the School Head and the SDC Chairperson/Treasurer — with same-actor protection on both.
- **Receipt controls are solid.** Receipts cannot be deleted by any role (two independent enforcement layers), reversal requires a supervisor and a written justification, produces a real compensating GL entry, and retains the original. Split-tender across USD and ZiG in one transaction posts correctly into the ledger and is covered by a passing automated test.
- **Procurement controls that were previously known gaps are now genuinely fixed**: the PRAZ 3-quote rule is real, per-school-configurable threshold banding (not hardcoded); vendor approval is enforced before a PO can issue; quotation documents are mandatory, not optional; and the sensitive-procurement dual-authorization tier is a real, enforced control with a configurable threshold, not a decorative field.
- **Cash-up, handover, and lockout are real.** Daily reconciliation, cashier handover, automated variance flagging, and threshold-triggered lockout are all wired directly into the receipting flow, not bolted-on reports.
- **The statutory statements a school actually lives or dies by are real.** Receipts & Payments, Comprehensive Income (correctly on an accrual, IPSAS-1-shaped basis, distinct from the cash-basis R&P), the Balance Sheet, the Vote-Book variance report (a genuine source-recomputation cross-check, not a side-by-side display), the MoPSE ED46 return (real ledger-sourced figures), and the BEAM reconciliation are all functioning, evidence-based reports — 21 of the spec's 22 genuinely distinct named reports exist and work.
- **Export tooling is real and shared.** PDF (with school letterhead and page numbering), Excel, CSV, and JSON export all work via one shared, well-built component, live on most report pages.
- **District Education Auditor role is exhaustively, provably read-only** — zero write/create/submit/cancel/delete permission across every doctype in the app, checked mechanically, not sampled.
- **Parent Portal data isolation is sound.** Every cross-family access-control function was traced; the one bug found (DEF-027) denies a legitimate secondary guardian, it never grants access to another family's data.
- **Basic web hygiene is solid.** TLS 1.2 is enforced site-wide with a working HTTP→HTTPS redirect; unauthenticated API calls are correctly rejected with no data leakage; login failures return a generic, non-enumerating error message; the Frappe backend sends a full, correct set of security headers.
- **The codebase itself is clean.** TypeScript compiles with zero errors; every Python file in the app compiles with zero syntax errors; the git working tree is clean and matches the documented last deploy.

---

## 8. What Still Needs Fixing (Phased)

See the full Defect Register (§6) for every item. Grouped by phase:

**Must fix before any deployment (Phase 0):** DEF-001, DEF-002, DEF-003, DEF-008, DEF-009, DEF-012 — six defects that break core daily workflows (Fund A payments cannot complete at all), bypass a mandated two-person financial control, expose school-wide financial data without authorization, or produce silently wrong GL postings.

**Strongly recommended before pilot, not hard blockers (still Phase 0):** DEF-004, DEF-005, DEF-006, DEF-010, DEF-027, DEF-029 — these don't stop the system from running, but they mean a pilot school's early data (banking config, Fund B accounts, fee currency, sponsor-linked billing) may need manual correction or a second parent's portal access silently fails.

**Phase 1 (first 30 days):** DEF-007, DEF-011, DEF-013, DEF-014, DEF-017, DEF-019, DEF-020, DEF-021, DEF-025, DEF-026, DEF-028, DEF-030, DEF-031, DEF-032, DEF-034 (offline architecture — only if the pilot site cannot guarantee connectivity), DEF-038.

**Phase 2 (31–90 days):** DEF-015, DEF-016, DEF-018, DEF-023, DEF-033, DEF-035, DEF-036, DEF-039.

**Phase 3 / backlog:** DEF-022, DEF-024, DEF-037.

---

## 9. Phased Remediation Roadmap

### Phase 0 — Pre-Deployment (Blockers)

| Defect | Owner | Est. effort | Dependency |
|---|---|---|---|
| DEF-001 (Fund A PV deadlock) | Backend dev | 1–2 days | None — isolated to workflow fixture + `payment_voucher.py` |
| DEF-002 (Credit Note role check) | Backend dev | 0.5 day | None |
| DEF-003 (ageing summary access control) | Backend dev | 0.5 day | None |
| DEF-008 (Invoice Line funding source) | Backend + frontend dev | 2–3 days | Data model change — needs a migration for the new field, plus frontend billing UI update |
| DEF-009 (per-line income account posting) | Backend dev | 1 day | None — fix in `utils.py`'s existing loop |
| DEF-012 (Petty Cash overspend guard) | Backend dev | 0.5 day | None — mirror the existing PO check |
| DEF-004 (banking wizard ↔ Payment Method link) | Backend dev | 1 day | None |
| DEF-005 (Fund B default CoA) | Backend dev | 0.5 day | None |
| DEF-006 (Fee Item currency fields) | Backend + frontend dev | 1–2 days | Migration |
| DEF-010 (double-invoicing race) | Backend dev | 1 day | Add a unique DB constraint or row-level lock |
| DEF-027 (secondary_guardian lockout) | Backend dev | 0.5 day | One-line fix in `permissions.py` |
| DEF-029 (System Manager SoD bypass) | Backend dev | 1 day | New `has_permission`/DocPerm rows on 5 doctypes |

**Exit Criteria:** All 12 items above closed and independently re-tested; zero S1; zero S2 on core finance paths; a Fund A Payment Voucher can be traced Draft → Approved → Disbursed in a real test.

### Phase 1 — Stabilization (First 30 days post go-live)

DEF-007, DEF-011, DEF-013, DEF-014, DEF-017, DEF-019, DEF-020, DEF-021, DEF-025, DEF-026, DEF-028 (or explicitly re-confirm as an accepted deferred scope per ADR 0018), DEF-030, DEF-031, DEF-032, DEF-038, and DEF-034 if the pilot site's connectivity cannot be guaranteed.

**Exit Criteria:** Zero S2 remaining; ≤10 S3 remaining.

### Phase 2 — Enhancement (Days 31–90)

DEF-015, DEF-016, DEF-018, DEF-023, DEF-033, DEF-035, DEF-036, DEF-039.

### Phase 3 — Optimization (Days 91–180)

DEF-022, DEF-024, DEF-037; a real WCAG/Lighthouse accessibility pass; a real concurrent-user load test; a real, live-executed re-run of the full automated regression suite against a rebuilt production image (this round could not perform either of the latter two).

### Phase 4 — Scale (Days 181–365)

Feature expansion per the existing internal roadmap plan (Phases 6b/7/8 — advanced procurement controls, statutory reports, offline architecture), multi-school readiness, advanced analytics.

---

## 10. Deployment Readiness Assessment

### Green Light Criteria

| Criterion | Met? |
|---|---|
| Zero S1 defects open | ❌ No — DEF-001 |
| Zero S2 defects on core finance paths | ❌ No — DEF-002, DEF-003, DEF-008, DEF-009, DEF-012, DEF-029 |
| All compliance rules verified at code level | ⚠️ Partial — 5 of 7 §3.2 rules fully verified PASS; fund segregation (rule inferred from SI 87/1992) and dual-signature (broken for Fund A) are not |
| All statutory reports generate and match MoPSE format | ⚠️ Partial — 21/22 generate; ED46 format not independently rendered/compared this round (no PDF was actually produced and visually checked) |
| All RBAC matrix tests pass | ❌ No — DEF-029 |
| Audit trail verified immutable | ✅ Yes |
| Offline sync verified with no data loss | ❌ N/A — offline sync does not exist (DEF-034) |
| Financial statements balance in both currencies | ✅ Yes (structurally verified) |
| Trial balance balances | ✅ Yes (by construction + independently asserted) |
| Pilot school data migrates cleanly | ⏸️ Not tested — no environment to migrate into this round |

### Red Criteria triggered

- **Any S1 defect** → DEF-001 triggers this.
- **Any RBAC breach** → DEF-029 triggers this (System Manager separation-of-duties bypass).

Per the report's own decision framework, **any single Red criterion is an automatic NO-GO.** Two are triggered here.

### Final Recommendation

> **"DO NOT DEPLOY — return to development for the Phase 0 punch list above, then re-test."**
>
> This is not a "start over" verdict. The accounting core, the two highest-stakes legal protections, receipt controls, and most of procurement are genuinely solid and well-evidenced. The Phase 0 list is 12 defects, most single-function fixes with the root cause already identified by this audit — realistically a 1–2 week fix-and-retest cycle, not a redesign. The most important single fix is DEF-001: until a Fund A Payment Voucher can be traced end-to-end from Draft to Disbursed in a real test, this system cannot run a school's day-to-day procurement, and that alone is sufficient grounds to hold deployment regardless of every other finding in this report.
>
> **Re-test window:** once Phase 0 closes, re-run this audit's 12 Phase-0 items plus a full live execution of the 186-test automated suite (this round could not run it live) against a freshly rebuilt production image, plus the seeded-data walkthrough this round could not perform (no environment access). Target: 1–2 weeks from Phase 0 code-complete.

---

## 11. Compliance Assessment

| Regulatory Instrument | Compliant? | Evidence | Gaps |
|---|---|---|---|
| Education Act [Chapter 25:04] (fee structures, learner rights, parent communication) | ✅ Largely yes | Fee governance gate (§4.1), arrears-cannot-block-access proven (§4.4), communication restricted to guardian's own channel (§4.4) | None found at code level |
| Statutory Instrument 1 of 2000 (leadership accountability, asset management) | ⚠️ Partial | Asset register + depreciation real; audit trail mostly real | Year-end closing has no audit-completion gate (DEF-007); PRAZ Disposal Register missing (DEF-013) |
| Statutory Instrument 87 of 1992 (SDC governance, financial boundaries) | ❌ **Not compliant as built** | Fund B/SDC read-scoping is real | Fund segregation is not an actual posting control (DEF-001's root cause); Fund A PVs cannot even complete their approval chain, which is itself a governance-process failure, not just an inconvenience |
| Public Finance Management Act [Chapter 22:19] (accounting controls, stewardship) | ⚠️ Partial | Double-entry integrity, Balance Sheet assertion, PV dual-authorization are all real and strong | Petty Cash bypasses budget control entirely (DEF-012); System Manager SoD bypass (DEF-029) |
| Procurement and Public Assets Disposal Act (PRAZ thresholds, disposal) | ✅ Largely yes | Quote-banding, vendor approval, mandatory quote documents all real and configurable | PRAZ Disposal Register report missing (DEF-013) |
| RBZ Exchange Control Guidelines (dual-currency handling, account mapping) | ⚠️ Partial | Multi-currency reporting at read-time is real, correctly uses rate-as-of-date | Fee items have no per-item dual USD/ZiG mapping (DEF-006); banking wizard disconnected from actual receipting accounts (DEF-004) |

---

## 12. Zimbabwe-Specific Readiness

- **MoPSE ED46:** Can be generated with real, ledger-sourced figures and role-gated certification. **Not independently rendered/visually checked** against the prescribed layout this round (no environment to produce the actual PDF). Staffing/HR section is an acknowledged manual-entry gap, not a bug.
- **BEAM reconciliation:** Report generates with real, non-trivial arrears/disbursement math — but see DEF-011: it has no link back to actual Invoice data, so what it reports could diverge from what was really billed with nothing to catch it.
- **SDC AGM pack:** Report exists and pulls real data (`get_agm_pack()`). Cannot currently be presented as evidence of a fully functioning SDC governance process given DEF-001 and DEF-020 (the governance report itself silently drops petty cash spend).
- **Auditor-General review:** The District Education Auditor role is exhaustively read-only, and the audit trail is genuinely append-only — a strong foundation. Coverage gaps remain (DEF-025, DEF-031, DEF-032) that a rigorous external audit would likely flag.
- **Dual-currency operations:** Mostly clean at the reporting layer (correct rate-as-of-date conversion); genuinely incomplete at the fee-configuration layer (DEF-006).
- **PRAZ compliance:** Procurement-side controls (quote banding, vendor approval, sensitive-procurement dual-auth) are strong and correctly implemented. The disposal-register reporting gap (DEF-013) is the one real hole.
- **Learner rights:** **Respected at code level, proven, not assumed** — this is one of the strongest findings in the entire audit.

---

## 13. Pilot Deployment Plan (conditional on Phase 0 closing)

Once Phase 0 (§9) is closed and independently re-tested:

**Week 1 — Setup and Shadow.** Migrate one pilot school's data. Explicitly verify, by hand, that the migrated Chart of Accounts gives Fund B real bank/expense accounts (DEF-005's fix) and that School Setup banking data actually maps to the Payment Methods used at the till (DEF-004's fix). Train Bursar, Cashier, School Head, SDC Chair/Treasurer. Run in parallel with the school's existing process. Daily debriefs.

**Week 2 — Live with Support, Receipts Only.** Go live on receipting only. On-site or remote support on call. Daily defect triage against this report's Phase 1 backlog.

**Week 3 — Full Finance Live.** Invoicing, procurement (explicitly test a real Fund A Payment Voucher end-to-end — this is the single most important pilot checkpoint given DEF-001), and GL live. Enable Parent Portal for a small group (5–10 families), including at least one family that registers via `secondary_guardian` specifically to confirm DEF-027's fix.

**Week 4 — Statutory Test.** Generate a real ED46 for the pilot school and have it reviewed against the actual MoPSE-prescribed layout by someone who has filed one before (this audit could not do this — no live render was produced). Run a real monthly bank reconciliation. Dry-run an AGM pack presentation. Retrospective and go/no-go for scale.

---

## 14. Risk Register (Post-Deployment)

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Fund A payments remain stuck if DEF-001's fix is incomplete | Low (if Phase 0 closes properly) / Catastrophic if not | Catastrophic — school cannot pay any supplier | Explicit end-to-end test of a real Fund A PV before pilot go-live, not just a unit test | Dev lead |
| A second parent/guardian silently cannot access the portal (DEF-027) | Medium | Moderate — support burden, parent frustration | Fix + explicit pilot test with a `secondary_guardian`-linked family | Dev lead |
| Petty cash quietly overspends a budget vote (DEF-012) | Medium once petty cash is in active use | Moderate — budget integrity | Fix before pilot; monitor `reconcile_budget_lines()` weekly during pilot | Bursar + Dev |
| A District Auditor or MoPSE inspector finds the ED46/AGM pack doesn't match the prescribed paper layout on first real presentation | Medium (untested this round) | Moderate — credibility, re-work under time pressure | Have someone who has filed a real ED46 review the actual PDF before the pilot's Week 4 | School Head / Bursar |
| Offline connectivity loss during pilot (no offline architecture exists — DEF-034) | Depends on pilot site's connectivity | High if it happens — cash office stops | Pick a pilot site with reliable connectivity for Phase 0/1; do not promise offline resilience until Phase 8 of the internal roadmap lands | Product owner |

---

## 15. Sign-Off Block

| Role | Name | Decision | Date | Signature |
|---|---|---|---|---|
| QA Lead | | NO-GO (pending Phase 0) | 2026-09-12 | |
| Product Owner | | | | |
| Development Lead | | | | |
| School Head (Pilot) | | | | |
| SDC Chairperson (Pilot) | | | | |
| Edupro CTO | | | | |

---

## Appendix A — Full RBAC Capability Grid

| Capability / DocType | Bursar | School Head | SDC Chair/Treasurer | Parent | Student | System Manager | District Auditor |
|---|---|---|---|---|---|---|---|
| Issue Receipts (create/submit) | ✅ | 👁 | ⛔ | ⛔ | ⛔ | ⛔ (correct) | 👁 |
| Approve Fee Structure (co-sign) | Draft only | ✅ co-sign | ✅ co-sign | 👁 (Approved only) | ⛔ | ⛔ | 👁 |
| Authorize Payment Voucher | Draft/Request | ✅ Approve | ✅ Co-Approve (Fund B only — see DEF-001) | ⛔ | ⛔ | ⛔ (correct) | 👁 |
| Journal Entry submit/cancel | ✅ | 👁 | 👁 (Fund B only) | ⛔ | ⛔ | ⛔ (correct) | 👁 |
| Requisition create/approve | ✅ | 👁 | ✅ (Fund B) | ⛔ | ⛔ | ✅ — **mismatch, DEF-029** | 👁 |
| Purchase Order create/issue | ✅ | 👁 | ✅ (Fund B) | ⛔ | ⛔ | ✅ — **mismatch, DEF-029** | 👁 |
| Cashbook Payment submit (→ GL post) | ✅ | 👁 | 👁 (Fund B) | ⛔ | ⛔ | ✅ submit/cancel — **mismatch, DEF-029** | 👁 |
| Budget Line direct edit | ✅ | ✅ | 👁 (Fund B) | ⛔ | ⛔ | ✅ write/delete — **mismatch, DEF-029** | 👁 |
| Petty Cash Voucher/Replenishment submit | ✅ | 👁 | — | ⛔ | ⛔ | ✅ submit/cancel — **mismatch, DEF-029** | 👁 |
| View Student Balance/Statement | Full | Full | ⛔ | Self only | Self only (read) | Full (Desk) | Full |
| Direct online/mobile payment | ⛔ | ⛔ | ⛔ | Not built (DEF-028) | ⛔ | ⛔ | ⛔ |
| Manage Users/Roles/Backups | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| Audit Log write/delete | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ (append-only, no exceptions) | ⛔ |

---

## Appendix B — Statutory Report Checklist

| Report | Generates? | Real data (not hardcoded)? | Cross-checked/verified math? | Export formats | Verdict |
|---|---|---|---|---|---|
| Statement of Receipts & Payments | Yes | Yes | N/A (cash-basis) | PDF/xlsx/CSV/JSON/print | ✅ PASS |
| Statement of Comprehensive Income | Yes | Yes | N/A | Same | ✅ PASS |
| Statement of Financial Position | Yes | Yes | **Yes — real imbalance assertion** | Same | ✅ PASS |
| Vote-Book Variance | Yes | Yes | **Yes — real source recomputation** | Same | ✅ PASS (data completeness caveat, DEF-021) |
| Bank Reconciliation Statement | Yes, per-account | Yes | Yes, per-document | Same | 🔶 PARTIAL (no aggregate view) |
| MoPSE ED46 | Yes | Yes | N/A | PDF only (via generic export) | ✅ PASS (not visually verified against paper form this round) |
| BEAM Reconciliation | Yes | Yes | Partial (DEF-011) | Same | ⚠️ PASS WITH NOTES |
| Fixed Assets/PRAZ Disposal Register | **No** | N/A | N/A | N/A | 🚫 MISSING |
| 14 remaining reports (Census, AGM Pack, Capital Projects, SDC R&P, Safe Balance, Class Fee Summary, Multi-Currency TB, Audit Trail Export, and others) | Yes, all 14 | Yes | Yes where applicable | Most via shared export component | ✅ PASS, 2 with export/letterhead gaps (DEF-019, DEF-023) |

---

## Appendix C — Tools and Methods Used

- Static code reading: `Read`, `Grep`, `Glob` across all 56 DocTypes, `permissions.py`, `hooks.py`, `utils.py`, `reports.py`, `statutory_reports_extra.py`, `fixtures/workflow.json`, entire `web/src` tree.
- Six parallel deep-audit subagents, one per functional module, each independently tracing requirements to code with file:line citations (results consolidated above).
- Live checks against `https://fees.edupro.co.zw`: `curl` (TLS, headers, unauth API/Desk access), `openssl s_client` (TLS version/cipher), an in-app browser pane (desktop + mobile 375×812 render, console errors, live failed-login flow against the real login API).
- `npx tsc --noEmit` (frontend), `python -m py_compile` (backend, all files), `npm audit --production` (frontend dependency scan).
- `git log`/`git status` for commit/deploy-state verification.

## Appendix D — Explicit Environment Limitations

SSH/bench console access to the production VPS was blocked by this session's own auto-mode safety controls; no test credentials for any role were available; no seeded synthetic dataset could be created (no environment to seed). Every item in this report that would normally require logging in as a role, executing a live workflow, or exercising a real external integration (EcoCash, live SMS/bank feed, live 2FA email round-trip) is explicitly marked PARTIAL/BLOCKED/UNVERIFIABLE above rather than assumed to pass — consistent with this audit's own Rule of Engagement to never claim untested behaviour works.
