# Edupro School Fees

School Fees & Financial Statements System for Zimbabwean Schools built on Frappe Framework.

## Installation

```bash
bench get-app edupro_school_fees
bench install-app edupro_school_fees
```

## Features

- School Setup Configuration
- Banking Configuration with multi-currency support (ZiG, FCA)
- Fund Configuration (Tuition/Government Account, SDC/SDA Project Account)
- Customizable Branding (colors, receipt/statement headers and footers)
- Role-based permissions for System Admin, School Head, and Bursar
- Fee Structure governance workflow (Draft -> Pending Approval -> Approved -> Rejected),
  blocked without AGM Minutes + MoPSE Approval Letter attached
- Student billing: Student, Parent Guardian, Beneficiary Category, Fee Item, Fee
  Structure, Invoice
- Cash office: Payment Method, Receipt (append-only; reversed, never deleted)
- Ledger: Account, Journal Entry — auto-posted on Invoice/Receipt submission
- Audit Log: append-only trail on every fee-governance and ledger event

See `../docs/decisions/` for scope decisions still open beyond Phase 1's interim
defaults (RBAC reconciliation, currency model, student-registry independence).

## Technology stack

Everything required for this system to run, end to end. Pin exact versions when
setting up a new environment — see "Recent fixes" below for what happens when a
version isn't pinned.

**Backend**

| Component | Version | Notes |
|---|---|---|
| Frappe Framework | **v16.35.0** (pinned) | `images/layered/Containerfile`'s `FRAPPE_BRANCH` build arg — must stay an exact tag, never a branch name |
| Python | 3.14.x | ships inside the `frappe/base`/`frappe/build` images |
| bench (CLI) | 5.x | bundled in the Frappe base image |
| Gunicorn | 23.x | WSGI server for the `backend` container |
| Node.js | 24.x | bundled in the backend image, for asset serving only (not app logic) |
| MariaDB | 10.11.x | primary database |
| Redis | 7.x (alpine) | cache + background-job queue broker |

**Frontend** — see [edupro-theme](https://github.com/Edupro-Enterprises/edupro-theme)'s own README for its full stack (React 19, Vite 8, TanStack Router/Query, TailwindCSS 4, TypeScript 6, etc.) — it's a separate repo/deploy from this one.

**Infrastructure** (shared across the whole Edupro Cloud platform, not fees-specific)

| Component | Version |
|---|---|
| OS | Ubuntu 24.04 LTS |
| Docker Engine | 29.x |
| Docker Compose | v5.x |
| Reverse proxy / TLS | Traefik v3.7 |

**Why pinning matters here specifically**: the Containerfile builds `frappe/frappe`
from source via `bench init --frappe-branch=${FRAPPE_BRANCH}`, and pulls
`frappe/build`/`frappe/base` Docker Hub images tagged with that same value. Left
as a branch name (`version-16`, `version-15`, etc.) instead of an exact release
tag, every rebuild silently picks up whatever's newest on that branch at that
moment — including unreleased, still-in-flux commits. See "Recent fixes" below
for what that actually broke, live, in one day.

## Recent fixes (2026-09-23 – 2026-09-24)

The Containerfile was pulling `frappe/frappe` via a **floating branch reference**
(`FRAPPE_BRANCH=version-16`, unpinned since at least 2026-09-10) instead of a
fixed release tag. Each rebuild picked up whatever was newest on that branch at
build time — not necessarily anything ever officially released — which is what
caused all of the following, fixed the same day. **Now pinned to `v16.35.0`,**
the exact release already tested and running in production; see "Technology
stack" above.

- **Site-wide login broken**: `frappe.core.doctype.user.user.get_roles`, the
  endpoint the frontend used to fetch a logged-in user's roles, was removed
  upstream. Added `edupro_school_fees.utils.get_my_roles`, a small wrapper
  around the stable internal `frappe.get_roles()`, so login no longer depends
  on core's moving whitelisted-API surface.
- **Site-wide permission regression**: the same version drift changed how core
  combines `has_permission` hook results — a hook returning `None` ("no
  opinion, defer to normal role permissions", the standard Frappe convention)
  is now treated as an explicit denial. Every `has_*_permission` function in
  `permissions.py` used that convention; fixed by returning `True` instead.
- **Direct-receipt overpayment**: a Receipt submitted directly against one
  Invoice for more than its outstanding balance had no cap — the excess was
  neither refunded nor tracked. Now caps the receipt and auto-splits the
  excess into a separate Advance receipt.
- **Cross-currency Invoice balance fix, then correction**: an initial fix made
  `Invoice.outstanding_amount` track the same converted (ZiG) figure the GL
  posts. That was wrong and was reverted the same day after it corrupted a
  real invoice in production — `Invoice` has no currency field of its own;
  `outstanding_amount` is a raw sum of Invoice Line amounts in the school's
  *native fee currency*, overwhelmingly USD in real data, not ZiG. The GL
  posting itself is correctly ZiG-converted (`Debtors` genuinely is a
  ZiG-denominated account); the invoice's own balance compares at face value
  against a same-currency receipt. A receipt in a genuinely different
  currency than an invoice's own fee items remains an open gap.

See `edupro_school_fees/edupro_school_fees/doctype/receipt/test_receipt.py`
for the regression test suite covering the payment/receipting cycle, and
`edupro_school_fees/utils.py`'s `create_journal_entry_for_receipt` /
`Receipt._cap_overpayment_into_advance` for the corrected currency reasoning.

## License

MIT
