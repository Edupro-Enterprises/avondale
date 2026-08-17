# Avondale — Edupro School Financial Statements System

A multi-currency (USD/ZiG) school financial management system built for Avondale Primary School, Zimbabwe, on Frappe/ERPNext v15. Generates the statutory financial reports, operational control reports, and transactional vouchers required by Ministry of Primary and Secondary Education (MoPSE) auditors.

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
