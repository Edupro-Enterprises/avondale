#!/usr/bin/env bash
# Run inside the `frappe` container (docker compose exec frappe bash) for first-time setup.
# Provisions a bench, creates a site, installs ERPNext + edupro_financials, and starts the dev server.
set -euo pipefail

SITE_NAME="${SITE_NAME:-avondale.localhost}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?Set MYSQL_ROOT_PASSWORD (matches infra/.env)}"

# The bind-mounted app source is owned by root (Windows bind mount), which git
# (running as the frappe user) refuses to touch without this explicit opt-in.
git config --global --add safe.directory /home/frappe/edupro_financials-src

if [ ! -d frappe-bench ]; then
	bench init frappe-bench --frappe-branch version-15 --no-procfile --no-backups --skip-redis-config-generation
fi
cd frappe-bench

bench set-config -g db_host mariadb
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379

if [ ! -d "sites/${SITE_NAME}" ]; then
	bench new-site "${SITE_NAME}" \
		--mariadb-root-password "${DB_ROOT_PASSWORD}" \
		--admin-password "${ADMIN_PASSWORD}" \
		--no-mariadb-socket
fi

[ -d apps/erpnext ] || bench get-app erpnext --branch version-15
bench --site "${SITE_NAME}" install-app erpnext

# edupro_financials customizes the "Fees" doctype, which ERPNext v14+ moved out
# of core into the separate "education" app - required before edupro_financials.
[ -d apps/education ] || bench get-app education --branch version-15.2
bench --site "${SITE_NAME}" install-app education

# edupro_financials's after_install hook hardcodes account names like
# "Tuckshop Sales - APS", assuming a Company (abbr "APS") with a standard Chart
# of Accounts already exists. That data is normally created by ERPNext's browser
# Setup Wizard, which a headless bootstrap never runs - so do it explicitly here.
bench --site "${SITE_NAME}" execute erpnext.setup.setup_wizard.operations.install_fixtures.install --kwargs '{"country": "Zimbabwe"}'
bench --site "${SITE_NAME}" execute frappe.client.insert --kwargs '{"doc": {"doctype": "Company", "company_name": "Avondale Primary School", "abbr": "APS", "default_currency": "USD", "country": "Zimbabwe"}}' || true
bench --site "${SITE_NAME}" set-value "Global Defaults" "Global Defaults" default_company "Avondale Primary School"

# install_fixtures(country="Zimbabwe") has a side effect discovered via system
# testing: it sets the system-wide default currency to "ZWL" (Zimbabwe's old
# regional default in ERPNext's fixture data, predating "ZiG"), which breaks
# every Sales Invoice/Fee (no ZWL->USD exchange rate exists). Force it back to
# the company's real currency. Global Defaults.default_currency also comes out
# of a fresh install pinned to "INR" - fix that too.
bench --site "${SITE_NAME}" execute frappe.db.set_default --kwargs '{"key": "currency", "value": "USD"}'
bench --site "${SITE_NAME}" set-value "Global Defaults" "Global Defaults" default_currency "USD"

# Also skipped by not running the browser Setup Wizard: default Price Lists
# (Sales Invoice requires one) and a Fiscal Year (every GL posting requires
# one) - both are standard ERPNext master data, not edupro_financials-specific.
bench --site "${SITE_NAME}" execute frappe.client.insert --kwargs '{"doc": {"doctype": "Price List", "price_list_name": "Standard Selling", "currency": "USD", "selling": 1, "enabled": 1}}' || true
bench --site "${SITE_NAME}" execute frappe.client.insert --kwargs '{"doc": {"doctype": "Price List", "price_list_name": "Standard Buying", "currency": "USD", "buying": 1, "enabled": 1}}' || true
bench --site "${SITE_NAME}" set-value "Selling Settings" "Selling Settings" selling_price_list "Standard Selling"
bench --site "${SITE_NAME}" execute frappe.client.insert --kwargs '{"doc": {"doctype": "Fiscal Year", "year": "2026", "year_start_date": "2026-01-01", "year_end_date": "2026-12-31"}}' || true

if [ ! -d apps/edupro_financials ]; then
	# edupro_financials-src is a plain bind-mounted directory, not its own git repo,
	# so `bench get-app` (which git-clones its source arg) needs a real repo to point at.
	if [ ! -d /home/frappe/edupro_financials-src/.git ]; then
		git -C /home/frappe/edupro_financials-src init -q
		git -C /home/frappe/edupro_financials-src add -A
		git -C /home/frappe/edupro_financials-src -c user.email=dev@localhost -c user.name=dev commit -q -m "local source snapshot"
	fi
	bench get-app edupro_financials /home/frappe/edupro_financials-src
fi
bench --site "${SITE_NAME}" install-app edupro_financials

bench --site "${SITE_NAME}" set-config developer_mode 1
bench --site "${SITE_NAME}" migrate
bench use "${SITE_NAME}"

echo "Setup complete. Run: bench start --port 8000 (host 0.0.0.0 already bound via docker port mapping)"
