# Avondale — Edupro School Financial Statements System

[![License: MIT](https://img.shields.io/badge/license-MIT-informational)](LICENSE)
[![frappe](https://img.shields.io/badge/frappe-v15-0089FF)](https://frappeframework.com/)
[![erpnext](https://img.shields.io/badge/erpnext-v15-0089FF)](https://erpnext.com/)
[![astro](https://img.shields.io/badge/astro-portal-FF5D01)](https://astro.build/)
[![docker](https://img.shields.io/badge/docker-compose-2496ED)](infra/docker-compose.yml)
[![school-management](https://img.shields.io/badge/topic-school--management-6f42c1)](https://github.com/Edupro-Enterprises/avondale)
[![financial-management](https://img.shields.io/badge/topic-financial--management-6f42c1)](https://github.com/Edupro-Enterprises/avondale)
[![fund-accounting](https://img.shields.io/badge/topic-fund--accounting-6f42c1)](https://github.com/Edupro-Enterprises/avondale)
[![accounting](https://img.shields.io/badge/topic-accounting-6f42c1)](https://github.com/Edupro-Enterprises/avondale)
[![zimbabwe](https://img.shields.io/badge/topic-zimbabwe-6f42c1)](https://github.com/Edupro-Enterprises/avondale)
[![education](https://img.shields.io/badge/topic-education-6f42c1)](https://github.com/Edupro-Enterprises/avondale)

A multi-currency (USD/ZiG) school financial management system built for Avondale Primary School, Zimbabwe, on Frappe/ERPNext v15. It generates the statutory financial reports, operational control reports, and transactional vouchers required by Ministry of Primary and Secondary Education (MoPSE) auditors, and gives non-technical school staff (Bursar, Headmaster, SDC Chairperson, Deputy Head) a dedicated web portal so none of them ever need Frappe Desk access.

Core capabilities: strict fund accounting across four statutory funds (SDC/SDA, Tuition/Government, BEAM & Donor Restricted, IGP) enforced at the GL Entry level via an Accounting Dimension; pre-commitment Vote-Book budget control on purchase requisitions; un-gapable sequential official receipt numbering with automatic gap detection; MoPSE-format statutory reports (Statement of Financial Performance/Position, Vote-Book Variance, Age-Analyzed Fee Arrears, Notes to the Financial Statements); blind-count daily till reconciliation; an auditor exception dashboard (cancelled receipts, backdated vouchers, manual cash entries, till variances); IGP enterprise counter sales with per-project trading accounts; and student fee exemptions/waivers (BEAM, staff discount, hardship) with mandatory supporting evidence.

**For a full technical walkthrough of every doctype, hook, permission grant, and the portal's REST contract with the backend — written for a third-party Frappe developer maintaining this system — see [docs/TECHNICAL.md](docs/TECHNICAL.md).**

## Structure

- **`edupro_financials/`** — custom Frappe app: fund accounting, vote-book budget control, sequential receipting, statutory reports (MoPSE Statement of Financial Performance/Position, Vote-Book Variance, Age-Analyzed Fee Arrears, Notes to the Financial Statements), and the transactional workflows (fee billing, purchase requisitions, IGP counter sales, student exemptions/waivers, credit notes, exchange revaluation).
- **`portal/`** — decoupled Astro frontend. The only interface Bursar/Headmaster/SDC Chairperson/Deputy Head use; none of these roles have Frappe Desk access (`desk_access = 0`).
- **`infra/`** — Docker Compose stack (MariaDB, Redis, Frappe bench, and the portal's nginx container).

## Local setup

```bash
cd infra
cp .env.example .env   # set a real MYSQL_ROOT_PASSWORD
docker compose up -d
```

The `frappe` service starts as a bare bench container (`sleep infinity` entrypoint) - `bench new-site`, `bench get-app`, and `bench install-app edupro_financials` still need to be run inside it for a first-time setup. The `edupro_financials` app's `after_install()` hook (see `install.py`) provisions roles, funds, accounting dimensions, custom fields, portal permissions, and reference master data (procurement item, walk-in customer, IGP trading accounts) automatically.

The `portal` service builds from `portal/Dockerfile` and serves on port 8082, proxying `/api`, `/printview`, and `/files` to the Frappe backend so the browser session stays same-origin.

## Notes

- Print formats and the school's Letter Head are shipped as Frappe fixtures (`edupro_financials/fixtures/`) and load automatically via `bench migrate`. The Letter Head's logo image itself is a `File` attachment tied to the original site's storage - re-upload the school crest via Desk (or the Letter Head fixture's `image` field) on a fresh deployment.
- No student, financial, or personal data is included in this repository.
