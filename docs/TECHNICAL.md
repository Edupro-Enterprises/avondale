# Technical Documentation

Audience: a Frappe/ERPNext developer who did not build this system and has to
maintain, extend, or redeploy it. This document explains *how the app is
wired together* — the doctypes, hooks, permission model, and the decoupled
portal's contract with the backend — not just what each file is called.

If you haven't worked with Frappe/ERPNext before, read the [Frappe Framework
docs](https://frappeframework.com/docs) and [ERPNext](https://docs.erpnext.com/)
first; this document assumes familiarity with DocTypes, the ORM, Script
Reports, Print Formats, and `bench`.

## Contents

1. [System overview](#1-system-overview)
2. [Fund accounting model](#2-fund-accounting-model)
3. [Custom DocTypes](#3-custom-doctypes)
4. [Custom fields on standard doctypes](#4-custom-fields-on-standard-doctypes)
5. [Hooks and business logic modules](#5-hooks-and-business-logic-modules)
6. [Roles and permissions](#6-roles-and-permissions)
7. [Statutory reports and Notes to the Financial Statements](#7-statutory-reports-and-notes-to-the-financial-statements)
8. [Print formats and Letter Head](#8-print-formats-and-letter-head)
9. [The portal (decoupled Astro frontend)](#9-the-portal-decoupled-astro-frontend)
10. [Installation flow (`install.py`)](#10-installation-flow-installpy)
11. [Infra / Docker Compose](#11-infra--docker-compose)
12. [Known constraints, gotchas, and non-obvious ERPNext behaviour](#12-known-constraints-gotchas-and-non-obvious-erpnext-behaviour)
13. [Extending the system](#13-extending-the-system)

---

## 1. System overview

```
┌─────────────────────┐        ┌──────────────────────────────────────┐
│  portal/ (Astro)     │  /api  │  frappe/ bench container              │
│  nginx : 8082        │───────▶│  Frappe v15 + ERPNext + Education     │
│  (Bursar/Headmaster/  │ same-  │  + edupro_financials (this app)       │
│   SDC/Deputy Head)    │ origin │  :8000                                │
└─────────────────────┘ proxy  └──────────────────────────────────────┘
                                          │
                                 ┌────────┴────────┐
                                 │ MariaDB / Redis  │
                                 └──────────────────┘
```

- **`edupro_financials`** is a standard installable Frappe app (`bench get-app` /
  `bench install-app` conventions apply). It adds custom doctypes, custom
  fields on ERPNext/Education doctypes, document-event hooks, four Script
  Reports, seven Print Formats, and a set of whitelisted REST methods that
  back the portal.
- **No desk-based UI was built for the school-side roles.** Headmaster,
  Bursar, SDC Chairperson, and Deputy Head are Frappe `Role`s with
  `desk_access = 0` and `User.user_type = "Website User"` — they physically
  cannot reach `/app`. Every feature they use is a portal page calling a
  `@frappe.whitelist()` Python function directly (not `frappe.client.*`
  generic CRUD, and not Script Report execution via `frappe.desk.query_report`,
  which requires Desk "Report" permission these roles don't have).
- System Manager / Accounts Manager / Accounts User (the built-in ERPNext
  roles) retain full Desk access for setup, accounting review, and anything
  not exposed on the portal (e.g. creating a new Fiscal Year, editing a Vote
  Book Allocation's approved budget).

## 2. Fund accounting model

Four statutory funds are provisioned by `install.py::create_funds()` as `Fund`
doctype records, and registered as an **Accounting Dimension** (`document_type
= "Fund"`) so every `GL Entry` carries a `fund` value:

| Fund | Fund Category | Purpose |
|---|---|---|
| SDC / SDA Fund | `SDC / SDA` | Development levies, capital works |
| Tuition / General Government Fund | `Tuition / Government` | Government tuition, admin running costs |
| BEAM & Donor Restricted Fund | `BEAM & Donor Restricted` | Donor/government assistance, tracked to individual beneficiaries |
| Income-Generating Projects (IGP) Fund | `IGP` | Enterprise sub-ledgers (tuckshop, uniform shop, bus hire, agriculture) |

Two parallel vocabularies exist for the same four funds and this trips people
up:

- **`Fund.fund_category`** (and the identical Select field added to `Purchase
  Order.funding_category` and `Vote Book Allocation.fund_category`) uses the
  short labels above (`SDC / SDA`, `Tuition / Government`, ...).
- **`Fund.name`** (the Link value GL Entries actually reference via the
  `fund` dimension) uses the long names (`SDC / SDA Fund`,
  `Tuition / General Government Fund`, ...).

`procurement.py::FUND_CATEGORY_TO_FUND` and `igp_sales.py::IGP_FUND` are the
translation tables between the two. If you add a fifth fund, update both the
`Fund` record set in `install.py` *and* any translation table that maps a
Select value to it.

A student's term bill is deliberately split into **two separate `Fees`
records** (Levy → SDC/SDA fund, Tuition → Tuition/Government fund) so each
posts to the correct fund in the GL — a single combined invoice would force
one `fund` value for both components. `receipts.py::attach_combined_fee_context`
re-merges the sibling records at print time so a parent sees one statement,
not two pieces of paper.

## 3. Custom DocTypes

All four live under `edupro_financials/edupro_financials/doctype/`.

### Fund
Simple master. `fund_name` (autoname `field:fund_name`), `fund_category`
(Select, matches the table above), `is_disabled`, `description`. No
controller logic beyond the framework defaults.

### Vote Book Allocation
The budget line: one row per `(fiscal_year, fund_category, expense_account)`
combination — `validate()` throws if that combination already exists
(`validate_duplicate`). Fields: `approved_budget` (editable), `committed_amount`
and `actual_spent` (both `read_only` — written only by `vote_book.py`, never
edited by hand), `available_balance` (computed in `validate()` via
`calculate_available_balance` — **note this is a display convenience only**;
the authoritative overrun check re-derives available balance independently in
`vote_book.py::validate_vote_book_budget` rather than trusting this stored
field, since it can be stale between saves).

### MoPSE Fee Approval
Submittable. One record per `(academic_year, term)` documenting the MoPSE
letter that authorized that term's maximum fee (`approved_usd_fee`,
`approved_zig_fee`, mandatory `Attach` field for the letter itself).
`validate()` only enforces `approved_usd_fee > 0`. Consumed by
`notes_to_accounts.py::get_mopse_reconciliation` to cross-check the actual Fee
Structure total against what was approved.

### Daily Cashier Reconciliation
Submittable, autoname `format:DCR-{cashier_user}-{reconciliation_date}` (one
per cashier per day — a second close attempt on the same day collides on the
name and fails, which is intentional). This is a **blind count**: the cashier
enters `usd_cash_counted`, `zig_cash_counted`, `ecocash_batch_total`,
`zipit_batch_total` with no visibility into what the system expects.
`before_submit()` (not `validate()` — deliberately deferred to submit time)
computes `system_expected_usd` from actual `Sales Invoice Payment` rows for
that cashier/date and derives `variance_usd = counted_total - system_expected_usd`.
See `cashier.py` for the whitelisted wrapper (`close_till`) the portal calls.

### Student Exemption and Discount
Submittable. `student` (Link), `exemption_type` (Select: `BEAM` / `Staff
Discount` / `Hardship`), `approval_minutes_ref` (mandatory free text — MoPSE
BEAM award ref, SDC minutes reference, etc.), `discount_percentage` and/or
`amount_covered`, and a **mandatory** `supporting_document` Attach field.
`validate()` enforces the supporting document requirement server-side even
though `reqd=1` already does — belt-and-suspenders because `insert(ignore_mandatory=True)`
elsewhere in the codebase could otherwise bypass it silently. Also requires at
least one of `discount_percentage` / `amount_covered` to be set.

## 4. Custom fields on standard doctypes

Added via `create_custom_fields()` calls in `install.py`, all `ignore_validate=True`
(so they install even if the target doctype isn't in a "safe to modify"
state yet during a fresh app install). Grouped by target doctype:

**`Purchase Order`** — `funding_category` (Select, budget-check key),
`fiscal_year` (Link), then the procurement compliance checklist:
`quotations_attached`, `comparative_schedule_attached`,
`proforma_invoice_attached` (all Check). Note: `Purchase Order.fund` (the
actual Accounting Dimension Link field) is auto-added by ERPNext's own
Accounting Dimension framework, not by this app — `edupro_financials` only
adds `funding_category`/`fiscal_year` as the *budget-check* keys, and
`procurement.py::FUND_CATEGORY_TO_FUND` bridges `funding_category` → `fund`
when a requisition is drafted.

**`Fees`** — `receipt_no` (read-only, sequential), `terminal` (default
`"HAR"`), `fund` (fetched from `fee_structure.fund` — ERPNext's Education app
never wired the Fund dimension onto `Fees` itself, only onto `Fee Structure`/
`Fee Schedule`, so without this every `Fees` GL posting lands in the reports'
`(Unassigned)` bucket), `is_opening_balance` (Check — excludes migrated
legacy-Pastel arrears from receipt numbering), `cancellation_reason` (Small
Text, `allow_on_submit=1`, required before cancel by `credit_notes.py`).

**`Sales Invoice`** — the same `receipt_no` / `terminal` pair as `Fees`, so
IGP counter sales feed the identical sequential-numbering and gap-detection
machinery instead of a second parallel system.

**`Student`** — `pastel_account_code` (read-only Data field): a reconciliation
key back to the legacy Pastel accounting system, preserved on student records
for migration audit trail purposes. (The actual migration script and its data
file are intentionally **not** included in this repository — see
[README](../README.md).)

**`Payment Entry`** — `comparative_schedule_attached`, `quotations_attached`,
`finance_committee_minutes_ref` — the payment-side half of the same
compliance checklist procurement carries at the requisition stage.

## 5. Hooks and business logic modules

`hooks.py::doc_events` is the entire wiring diagram for automatic behaviour:

```python
doc_events = {
    "Purchase Order": {
        "validate":   "edupro_financials.vote_book.validate_vote_book_budget",
        "on_submit":  "edupro_financials.vote_book.commit_vote_book_amount",
        "on_cancel":  "edupro_financials.vote_book.release_vote_book_amount",
    },
    "Fees": {
        "on_submit":     "edupro_financials.receipts.assign_receipt_number",
        "before_cancel": "edupro_financials.credit_notes.require_cancellation_reason",
        "before_print":  "edupro_financials.receipts.attach_combined_fee_context",
    },
    "Sales Invoice": {
        "on_submit": "edupro_financials.receipts.assign_receipt_number",
    },
}
```

Everything else in the app is either a whitelisted REST endpoint the portal
calls directly, or a Script Report's `execute()`.

### `vote_book.py` — pre-commitment budget control
- `validate_vote_book_budget` (Purchase Order `validate`): for every item
  with an `expense_account`, looks up the matching `Vote Book Allocation` by
  `(expense_account, funding_category, fiscal_year)`. No match → hard
  `frappe.throw`. Match found → computes `available = approved_budget -
  (committed_amount + actual_spent)` **live from the DB**, not from the
  doctype's stored `available_balance` field, and throws
  `"VOTE-BOOK OVERRUN EXCEPTION"` if the line's `amount` exceeds it. This
  runs on every `save()`, including drafts — so `procurement.py::create_requisition`
  rejects an over-budget line at drafting time, not just at submission.
- `commit_vote_book_amount` / `release_vote_book_amount` (`on_submit` /
  `on_cancel`): add/subtract the submitted PO's line amounts to/from
  `committed_amount` on the matching allocation. There is no equivalent hook
  moving `committed_amount` → `actual_spent` on Payment Entry — actual spend
  tracking against `actual_spent` is not currently automated; only submission
  commitment is. (See §13 for what a "commit → actual" flow would need.)
- Only wired for `Purchase Order`. A Material Request-based requisition flow
  would need the same three hooks plus a custom `expense_account` field on
  Material Request Item (which doesn't exist in stock ERPNext).

### `receipts.py` — sequential, gap-detectable receipt numbering
- `assign_receipt_number` (`Fees.on_submit`, `Sales Invoice.on_submit`):
  format `REC-{TERMINAL}-{YYYY}-{#####}`, allocated via Frappe's own
  `make_autoname` series counter (safe under concurrent submission — no
  read-then-increment race). Skipped when `is_opening_balance` is set, and
  skipped when the record is submitted purely as a bill with nothing yet
  collected (`outstanding_amount >= grand_total`, i.e. billing without
  payment) — a receipt number means cash was actually received, not that an
  invoice exists.
- `attach_combined_fee_context` (`Fees.before_print`): in-memory only, never
  persisted — merges the sibling Fees record(s) for the same
  student+academic_term (Levy + Tuition) onto the document being printed so
  the rendered receipt/statement shows one combined total.
- `get_receipt_sequence_gaps()`: scans all `REC-...`-numbered `Fees` rows,
  buckets by `(terminal, year)`, and reports any missing sequence number as a
  gap — surfaced on the Auditor Exception Dashboard. A gap means a receipt
  was skipped, deleted at the DB level, or renumbered outside the app.

### `credit_notes.py` — mandatory reversal reason
- `require_cancellation_reason` (`Fees.before_cancel`): blocks cancellation
  unless `cancellation_reason` is already set (skipped for
  `is_opening_balance` rows, which are corrected in bulk during migration
  review, not one at a time). Frappe's own cancel already reverses the GL
  Entries automatically — this hook only adds the *why*, which then renders
  on the "Credit Note" print format.

### `revaluation.py` — exchange gain/loss revaluation (whitelisted, manual trigger)
- `revalue_zig_accounts(new_rate, posting_date=None)`: for every non-group
  Account with `account_currency = "ZiG"`, computes the current ZiG balance
  and its current USD book value from `GL Entry`, multiplies the ZiG balance
  by `new_rate` to get the new USD value, and posts a Journal Entry for the
  difference (per account, per fund) against a dedicated `Exchange
  Gain/Loss - APS` income account (auto-created on first use by
  `ensure_exchange_gain_loss_account`).
- The Journal Entry's `voucher_type` is deliberately set to `"Exchange Gain
  Or Loss"` — this is the one voucher type ERPNext's own controller
  special-cases in `set_amounts_in_company_currency()`, skipping the
  recompute of `debit`/`credit` from `debit_in_account_currency *
  exchange_rate`. Without that special-casing the controller would silently
  zero out the manually-computed debit/credit, since a pure revaluation
  moves the *valuation*, not the underlying ZiG amount.
- Not wired to any hook — this is a deliberate manual action (a System
  Manager/Accounts role runs it when MoPSE issues a new official rate), not
  something that should fire automatically on every transaction.

### `procurement.py` — Expenditure Requisitions (Vote-Book Drafting)
Whitelisted REST surface backing the portal's `/procurement/` page:
- `get_form_options()` — expense accounts, fund categories, suppliers, fiscal
  years for the form.
- `get_vote_book_balance(expense_account, fund_category, fiscal_year)` — the
  **same lookup** `vote_book.py`'s hook will run at save time, exposed
  read-only so the UI can show "available balance" before the Bursar commits
  to an amount. Keeping this in sync with the hook's own query is important:
  if they diverge, the UI could show "fits" for something the save then
  rejects.
- `create_requisition(...)` — inserts a **draft** (`docstatus=0`) Purchase
  Order. The `validate` hook still runs on every `insert()`/`save()`, so an
  over-budget line is rejected immediately, not silently allowed through
  until submission.
- `attach_procurement_files(...)` — flips the three compliance Check fields
  once the corresponding file(s) are uploaded via `api.uploadFile` (which
  calls Frappe's own `/api/method/upload_file` against the Purchase Order
  first).
- `submit_requisition`, `list_requisitions`, `get_requisition_detail`.
- Grants (via `install.py::grant_bursar_procurement_permissions`): Bursar
  gets full CRUD+submit on `Purchase Order`, CRUD on `Supplier`, and
  **read-only on `Item`** — required because ERPNext's `get_item_details()`
  (called internally from Purchase Order's own `validate()`) does its own
  explicit `check_permission()` against Item regardless of the parent
  document's `ignore_permissions` flag. Miss this grant and drafting fails
  with a bare `PermissionError` that has nothing to do with the requisition
  itself.

### `igp_sales.py` — IGP Counter Sales (Enterprise Receipting)
Each sale is a **POS-mode `Sales Invoice`**, inserted and submitted
immediately (not left as a draft bill, unlike `Fees` term billing) — this is
cash-in-hand at point of sale, so there's no "invoiced but unpaid"
intermediate state. One generic non-stock Item per project
(`IGP_PROJECTS` in `install.py`, e.g. `Tuckshop Sale`) with its own dedicated
income account, so each enterprise activity keeps its own trading account
(spec requirement: "preserve individual project trading accounts") while
every sale is also tagged `fund = "Income-Generating Projects (IGP) Fund"`
for fund-level rollup. `get_project_totals()` sums `GL Entry` per
project-specific account for the per-project breakdown shown on the portal.
Sales post against a single shared `Walk-In / Enterprise Sales` Customer —
there is no per-buyer customer record for counter sales.

### `exemptions.py` — Student Exemptions & Waivers Entry
`create_exemption` throws before even constructing the document if
`supporting_document` (a file URL, already uploaded via `api.uploadFile`) is
missing — belt-and-suspenders alongside the doctype's own `reqd=1` +
`validate()` check. `search_students` is a plain `LIKE` search over
`Student.student_name`/`name`, used by the portal's typeahead.

### `cashier.py` — Till Close-Out
Thin whitelisted wrapper around `Daily Cashier Reconciliation`:
`get_till_context()` tells the portal whether today's till is already
closed for the current user (so the form can be hidden/disabled);
`close_till(...)` inserts and submits the reconciliation (variance
computed by the doctype's own `before_submit`, described in §3).

### `ledger.py`, `oversight.py`, `auditor_dashboard.py`, `fees_browser.py`, `notes_to_accounts.py`, `statutory_reports.py`
Read-only aggregation/query modules backing specific portal pages — no
side effects, all `@frappe.whitelist()` GET-style calls. See §9 for which
portal page calls which module. Two are worth calling out specifically:

- **`statutory_reports.py`** doesn't reimplement the four Script Reports —
  it imports each report module's `execute(filters)` function directly and
  calls it in-process, bypassing `frappe.desk.query_report.run` (which
  requires Desk "Report" permission the portal roles don't have). If you add
  a fifth Script Report and want it on the portal, add it to the `REPORTS`
  dict here — not by trying to grant Report permission.
- **`auditor_dashboard.py`** flags backdated vouchers using
  `datediff(date(creation), posting_date) > 3` across `Sales Invoice`,
  `Purchase Order`, `Payment Entry`, `Journal Entry` — i.e. a document whose
  *creation timestamp* trails its *posting date* by more than 3 days. This
  threshold (`BACKDATE_THRESHOLD_DAYS`) is a hardcoded module constant.

## 6. Roles and permissions

Four custom roles, all `desk_access = 0`, all `Website User` type:
`Headmaster`, `Bursar`, `SDC Chairperson`, `Deputy Head`. There is no fifth
"Auditor" role — the Auditor Exception Dashboard is exposed to **Deputy
Head** (see the portal's `/auditor/` route).

Permissions are granted document-by-document via `Custom DocPerm` (not
standard Role Permission Manager entries baked into doctype JSON, since these
are third-party-app roles layered onto standard ERPNext/Education doctypes).
All the `install.py::grant_*` helper functions follow the same pattern:
`add_permission()` creates the `Custom DocPerm` row with the first requested
`ptype`, then `update_permission_property()` flips on any remaining `ptype`s
— `add_permission` does **not** layer additional ptypes onto an existing row,
so you cannot just call it twice with different ptypes and expect both to
stick.

| Role | Full CRUD + submit | Read-only |
|---|---|---|
| **Bursar** | Daily Cashier Reconciliation, Purchase Order, Supplier, Sales Invoice, Customer, Student Exemption and Discount | Item, Account, Vote Book Allocation, + all of `OVERSIGHT_READ_DOCTYPES` below |
| **Headmaster / SDC Chairperson / Deputy Head** | — | `OVERSIGHT_READ_DOCTYPES`: GL Entry, Fees, Journal Entry, Purchase Order, Payment Entry, Sales Invoice, Vote Book Allocation, Daily Cashier Reconciliation, Fund, MoPSE Fee Approval, Student, Student Exemption and Discount, Fee Schedule, Fee Structure |

Why the read grants matter even though most portal calls use
`frappe.get_all`/raw SQL with implicit admin context in some places: several
whitelisted methods (e.g. `ledger.py`, `oversight.py`) run plain
`frappe.get_all` calls **without** `ignore_permissions=True`, relying on the
caller's own role having read access. Without the explicit grant,
`frappe.get_all` for a Website User doesn't raise — it silently returns an
empty list, which is strictly worse than an error (a Deputy Head would see
"no exceptions found" for a reason that has nothing to do with there
actually being no exceptions). If you add a new query against a doctype not
already in `OVERSIGHT_READ_DOCTYPES`, add it there too.

`Print Settings.allow_print_for_cancelled` is set to `1` globally
(`install.py::configure_print_settings`) — required because the "Credit
Note" print format exists specifically to print a *cancelled* Fees record as
proof of a reversed receipt, and Frappe blocks printing cancelled
submittable documents by default.

## 7. Statutory reports and Notes to the Financial Statements

Four Script Reports under `edupro_financials/edupro_financials/report/`,
each a plain `execute(filters) -> (columns, data)` module (no `.js` filter
UI is shipped — filters are driven entirely from the portal, and from Desk
the report still runs with the standard auto-generated filter sidebar):

| Report | Key logic |
|---|---|
| **Age Analyzed Fee Arrears Schedule** | Buckets outstanding `Fees` by days overdue vs. `as_on_date` in fixed 90-day terms (`Current` / `1 Term` / `2 Terms` / `3+ Terms`). Flags `beam_status` per row against students with a submitted BEAM `Student Exemption and Discount`. Filterable by academic year/term, fund, class (via `Program Enrollment`), and due-date range. |
| **MoPSE Statement of Financial Performance** | Income − Expenditure, columned per Fund + a Total column, for a date range. Sums `GL Entry.credit - debit` (Income) / `-(debit - credit)` (Expense) grouped by account and fund. |
| **MoPSE Statement of Financial Position** | Assets / Liabilities / Fund Reserves (Equity), columned per Fund, as at a date. Includes a "Net Position" check row (`Assets − Liabilities − Equity`, should be ~0 per fund) as a built-in balance-sheet sanity check. |
| **Vote-Book Variance Statement** | Straight listing of every `Vote Book Allocation` with `total_utilized = committed + spent` and `percent_utilized`, filterable by fiscal year / fund category. |

Both MoPSE statements use `frappe.scrub(fund_name)` as the column
`fieldname` for each fund's column — if a `Fund.name` contains characters
`frappe.scrub` treats specially, the generated column key changes; the
portal reads columns dynamically from the `columns` array returned by
`execute()`, so this is self-consistent, but a hardcoded fund name anywhere
else in the codebase would need to track the same scrubbing.

**`notes_to_accounts.py`** is *not* a Script Report — it's a whitelisted
function returning a structured JSON payload (accounting policy text blocks +
Note 10 arrears aging summary + Note 11 bank/cash balances + the MoPSE
approval-vs-actual reconciliation), rendered entirely by the portal's
`/reports/` page. Note numbering (10, 11) follows the original spec
document's numbering, not any framework convention.

## 8. Print formats and Letter Head

Seven custom Print Formats (module `Edupro Financials`) plus one Letter Head
(`Avondale Primary School`), shipped as **Frappe fixtures**
(`edupro_financials/fixtures/{print_format.json, letter_head.json}`) rather
than the more common file-based Jinja print format convention — they were
originally authored via ad-hoc `frappe.get_doc(...).insert()` calls in the
Frappe console during development, so exporting them as fixtures
(`bench export-fixtures --app edupro_financials`) was the retrofit that made
them reproducible from source. `hooks.py::fixtures` scopes the export/import
to exactly these two doctypes/filters — **don't broaden that filter** without
checking what else matches; an unscoped `Print Format` fixture would try to
capture every print format on the whole site, including ones that belong to
other apps.

| Print Format | Bound doctype |
|---|---|
| Fee Receipt (POS) | Fees |
| Credit Note | Fees (cancelled) |
| Purchase Order Voucher | Purchase Order |
| Payment Voucher | Payment Entry |
| Till Close-Out Sheet | Daily Cashier Reconciliation |
| Student Exemption Voucher | Student Exemption and Discount |
| Enterprise Sale Receipt | Sales Invoice (IGP sales) |

**The Letter Head's logo image is not portable.** `Letter Head.image` is a
`File` attachment tied to the original site's storage path — the fixture
JSON carries the *reference*, not the file bytes. On a fresh deployment, the
fixture will import but the crest image will 404 until you re-upload the
school crest via Desk (Letter Head record) or replace `image` with a new
`File` on the new site.

The portal reaches printable output through Frappe's own `www/printview.py`
page and its PDF endpoint (`/printview?doctype=...&name=...&format=...`),
proxied same-origin through nginx/Vite (see §9) — it does not use
`frappe.utils.pdf` or any custom PDF generation path.

## 9. The portal (decoupled Astro frontend)

`portal/` is a static-built [Astro](https://astro.build) site, containerized
separately from Frappe (`portal/Dockerfile`: `npm run build` → served by
nginx). It is **not** a Frappe "Website" (no Jinja, no `www/` folder in this
app) — it's a wholly separate frontend that only ever talks to the backend
over its whitelisted REST methods.

### Same-origin session strategy

The portal never uses an API key/secret — it relies on Frappe's own
session cookie, obtained by POSTing to the standard `/api/method/login`
endpoint (`api.js::login`) and set with `credentials: 'include'` on every
subsequent `fetch`. For that cookie to be valid across requests without
CORS/SameSite friction, **the browser must see the portal and the API on the
same origin** — solved two different ways depending on environment:

- **Dev** (`astro dev`): `astro.config.mjs` configures a Vite proxy,
  `/api` → `http://avondale.localhost:8000`.
- **Production** (`docker compose`): `portal/nginx.conf` proxies `/api/`,
  `/printview`, and `/files/` to the `frappe` service inside the Compose
  network, with `proxy_set_header Host avondale.localhost` so Frappe's own
  site-resolution logic sees the hostname it expects regardless of what the
  browser actually connected to.

If you ever move the Frappe site to a different `site_name`, both the Vite
proxy target and every `Host` header override in `nginx.conf` need to change
together, or requests will 404 at the Frappe multi-tenancy layer even though
the network path is fine.

### `src/lib/api.js` — the entire backend contract

One file, no SDK. `call(method, args, {method: httpMethod})` builds a
`/api/method/<dotted.path>` request (GET with querystring, or POST with
`application/x-www-form-urlencoded` body) and unwraps Frappe's
`{"message": ...}` envelope. `api.uploadFile(file, doctype, docname)` is the
one exception — it POSTs `multipart/form-data` straight to
`/api/method/upload_file` (Frappe's built-in file upload endpoint) with
`is_private: '1'`, and returns `file_url`, which callers then pass into
whatever whitelisted method persists that reference (e.g.
`exemptions.create_exemption(supporting_document=file_url)`).

Every exported `api.*` function maps 1:1 to a Python `@frappe.whitelist()`
method — see the table below. Adding a portal-facing backend method always
means: write the Python function, whitelist it, then add exactly one
corresponding entry to `api.js`.

`requireRole(allowedRoles)` (called at the top of every role-specific page's
`<script>` block) is **defense in depth, not the actual security boundary**
— the real enforcement is server-side `Custom DocPerm`. This just stops the
wrong role's *page* from rendering (a Headmaster hitting `/bursar/` directly
gets redirected before the till-close form even shows), rather than relying
on the user never trying the URL.

### Pages and what they call

| Route | Roles | Backend module(s) |
|---|---|---|
| `/login` | anyone | `login`, `portal.get_session_info` |
| `/bursar/` | Bursar | `cashier.*` (till close), `fees_browser.*` (fee ledger) |
| `/auditor/` | Deputy Head | `auditor_dashboard.get_exceptions` |
| `/oversight/` | Headmaster, SDC Chairperson (+ Bursar for reading) | `oversight.get_summary` |
| `/fees/` , `/fees/statement` | all 4 roles | `fees_browser.*` |
| `/procurement/` | Bursar (create), all 4 (read) | `procurement.*` |
| `/igp/` | Bursar (create), all 4 (read) | `igp_sales.*` |
| `/exemptions/` | Bursar (create), all 4 (read) | `exemptions.*` |
| `/reports/` | all 4 | `statutory_reports.*`, `notes_to_accounts.get_notes` |
| `/` (`index.astro`) | anyone with a session | routes to the role's landing page (see `login.astro::ROLE_LANDING`) |

Landing-page routing after login (`login.astro`): Bursar → `/bursar/`,
Deputy Head → `/auditor/`, Headmaster/SDC Chairperson → `/oversight/`.

### File upload pattern used across procurement/exemptions

1. Frontend calls `api.uploadFile(file, null, null)` → gets back `file_url`.
2. Frontend calls the domain-specific whitelisted method
   (`attach_procurement_files` / `create_exemption`) passing that URL.
3. Frontend **re-fetches the list** (`loadRequisitions()` /
   `loadExemptions()`) rather than patching local state — this was a real
   bug found during end-to-end testing (a compliance-checklist column stayed
   stale after upload until the page was manually refreshed); the fix was to
   always re-fetch after a mutating call rather than assume the response
   payload is enough to update the UI incrementally.

## 10. Installation flow (`install.py`)

`hooks.py::after_install = "edupro_financials.install.after_install"` runs
once, automatically, at the end of `bench install-app edupro_financials`.
Order matters — later steps depend on earlier ones (e.g. IGP accounts need
`Global Defaults.default_company` to already resolve, procurement custom
fields need `Purchase Order.fiscal_year` to already exist as a target for
`insert_after`):

1. `create_roles()` — the four portal roles, `desk_access=0`.
2. `create_zig_currency()` — enables `ZiG` as a Currency if not already
   present/enabled.
3. `create_funds()` — the four `Fund` records.
4. `create_fund_accounting_dimension()` — registers `Fund` as an Accounting
   Dimension (no-ops if ERPNext isn't installed yet, or the dimension already
   exists).
5. `create_vote_book_custom_fields()` — `Purchase Order.funding_category` / `fiscal_year`.
6. `create_receipt_custom_fields()` — `Fees.receipt_no` / `terminal`.
7. `create_fees_fund_field()` — `Fees.fund` (fetched from Fee Structure).
8. `create_migration_custom_fields()` — `Student.pastel_account_code`, `Fees.is_opening_balance`.
9. `create_portal_role_permissions()` — Bursar full CRUD on the till doctype;
   all four roles read-only across `OVERSIGHT_READ_DOCTYPES`.
10. `create_voucher_custom_fields()` — `Fees.cancellation_reason`, Payment Entry compliance fields.
11. `configure_print_settings()` — allow printing cancelled documents.
12. `create_procurement_item()` — the one generic non-stock Item every requisition line uses.
13. `create_procurement_custom_fields()` — the 3 Purchase Order compliance Check fields.
14. `grant_bursar_procurement_permissions()` — PO/Supplier/Item/Vote Book Allocation grants.
15. `create_igp_accounts()` — the IGP income-account group + one account per project.
16. `create_igp_items()` — one non-stock, sales-enabled Item per project, defaulted to its own income account.
17. `create_walk_in_customer()` — the shared `Walk-In / Enterprise Sales` Customer.
18. `create_sales_invoice_custom_fields()` — `Sales Invoice.receipt_no` / `terminal`.
19. `grant_bursar_igp_permissions()` — Sales Invoice/Customer/Account grants.
20. `grant_bursar_exemption_permissions()` — Student Exemption and Discount grants.
21. `frappe.db.commit()`.

Everything is written to be **idempotent** (`if not frappe.db.exists(...)`
guards throughout), so re-running `after_install` manually (e.g. via `bench
execute edupro_financials.install.after_install`) after pulling in new code
is safe and is the standard way to apply newly-added provisioning logic to
an already-installed site — there is no separate patch/migration for most of
this (the one real data patch, the legacy Pastel roster import, is excluded
from this repository; see the README).

Two real ERPNext permission-model gotchas were found and fixed while
building this — both are called out inline in `install.py`'s own comments
and are worth knowing before you add a new whitelisted method that inserts a
Purchase Order or Sales Invoice on a portal role's behalf:

- `Purchase Order.validate()` calls ERPNext's `get_item_details()`, which
  does its own `check_permission()` against `Item` — independent of
  `ignore_permissions=True` on the parent document.
- Creating a `Sales Invoice` resolves the receivable account via
  `get_party_account()`, which does its own permission check against
  `Account` the same way.

If a new portal-facing insert against either doctype starts failing with a
bare `PermissionError`, check whether the acting role has read access to
whatever *child* doctype the standard controller validates against — it is
very rarely the parent document's own permission that's missing.

## 11. Infra / Docker Compose

`infra/docker-compose.yml` services:

| Service | Image / build | Purpose |
|---|---|---|
| `mariadb` | `mariadb:10.11` | Frappe's database. `utf8mb4` forced via command-line flags (required by Frappe). Root password from `${MYSQL_ROOT_PASSWORD}` (see `.env.example`). |
| `redis-cache` / `redis-queue` | `redis:6.2-alpine` | Frappe's cache and background-job queue backends. |
| `frappe` | `frappe/bench:latest`, entrypoint overridden to `sleep infinity` | **Bare bench container** — no site exists yet on first boot. You still need to `bench new-site`, `bench get-app erpnext`, `bench get-app education`, `bench install-app edupro_financials` inside it (see README). |
| `portal` | builds from `portal/Dockerfile` | The Astro frontend + nginx reverse proxy, port `8082` on the host. |

`frappe`'s ports `9000-9010` are exposed for the bench's live-reload/socketio
range; `8000` is the site's HTTP port the `portal` nginx config proxies to
internally (`http://frappe:8000` — Compose's internal DNS, not `localhost`).

There is no seed/fixture step for `bench new-site` itself in this repo — a
fresh deployment is genuinely a from-scratch ERPNext + Education install,
with `edupro_financials`'s `after_install()` doing all app-specific
provisioning automatically once installed.

## 12. Known constraints, gotchas, and non-obvious ERPNext behaviour

- **`Vote Book Allocation.available_balance` is a display cache, not the
  source of truth.** The actual overrun check in `vote_book.py` always
  re-queries `approved_budget`/`committed_amount`/`actual_spent` fresh — do
  not refactor the hook to trust the stored field without also guaranteeing
  it's always current.
- **There is no `committed_amount` → `actual_spent` transition wired up
  anywhere.** Submitting a Purchase Order commits the amount; nothing moves
  it to "actually spent" when a Payment Entry against that PO is later
  submitted. If MoPSE audit requirements need `actual_spent` to reflect real
  disbursement (not just commitment), that's a gap to close, not an existing
  feature to rely on.
- **Receipt numbering only fires when money is actually received.** A
  `Fees` record submitted as a pure bill (no payment yet) gets no
  `receipt_no` at submission — only later, when a Payment Entry brings
  `outstanding_amount` below `grand_total` and the record is (re-)submitted
  through a path that re-triggers `on_submit`. If you build a payment-entry
  workflow against `Fees`, verify a receipt number actually gets assigned at
  the point payment is recorded, not just at invoicing.
- **The exchange rate is not a live feed and is not meant to be one.**
  `revaluation.py` is a manually-triggered whitelisted method, not a
  scheduled task. There is intentionally no automatic FX rate sync.
- **Two IGP "granularity levels" are not redundant.** The `Fund` dimension
  answers "how much IGP money exists in total"; the per-project income
  account (`Tuckshop Sales - APS`, etc.) answers "how much came from the
  tuckshop specifically." Don't collapse these into one when refactoring —
  they answer different audit questions.
- **Backdated-voucher detection uses `creation` vs. posting-date drift, not
  a user-editable "backdated" flag.** `BACKDATE_THRESHOLD_DAYS = 3` is a
  hardcoded constant in `auditor_dashboard.py`.
- **The one-time Grade 7 Pastel roster migration is not in this repository.**
  It contained real student names, class codes, and fee balances. If you
  need to see how legacy-system data was imported for reference, that logic
  lived in `edupro_financials/patches/migrate_grade7_pastel_roster.py`
  (removed) — the general pattern was: bulk-insert `Fees` rows with
  `is_opening_balance=1` (so they're excluded from receipt numbering and
  mandatory cancellation-reason enforcement) tagged with the student's
  `pastel_account_code` for reconciliation.

## 13. Extending the system

- **Adding a new fund**: add it to `install.py::FUND_CATEGORIES`, add its
  Select option everywhere `FUND_CATEGORY_OPTIONS`-style strings are
  duplicated (`Purchase Order.funding_category`, `Vote Book
  Allocation.fund_category`, the `Fund.fund_category` field itself), and add
  a translation entry in any `FUND_CATEGORY_TO_FUND`-style dict
  (`procurement.py`) if the new fund needs to back a requisition or sale.
- **Adding a new statutory report**: write it as a standard Script Report
  under `edupro_financials/edupro_financials/report/`, then register it in
  `statutory_reports.py::REPORTS` with a short `report_key` — that's what
  makes it reachable from the portal. Registering it there is necessary
  *and sufficient*; Desk access to run it via the normal Report list also
  keeps working independently, since it's a real Script Report either way.
- **Adding a new portal-facing backend method**: write the Python function
  in the relevant module, decorate `@frappe.whitelist()`, add the
  corresponding grant in `install.py` if it touches a doctype not already
  covered (remember: `frappe.get_all` silently returns empty rather than
  raising for missing read permission — a "works but returns nothing" bug is
  much easier to miss than a `PermissionError`), then add exactly one
  function to `portal/src/lib/api.js`.
- **Adding a new print format**: build it via Desk (Print Format Builder or
  a raw HTML/Jinja format) in the `Edupro Financials` module, then re-run
  `bench export-fixtures --app edupro_financials` to capture it into
  `fixtures/print_format.json` so it ships with the app on a fresh install.
