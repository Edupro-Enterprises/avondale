#!/usr/bin/env bash
# Run inside the `frappe` container (docker compose exec frappe bash) for first-time setup.
# Provisions a bench, creates a site, and installs edupro_school_fees.
set -euo pipefail

SITE_NAME="${SITE_NAME:-avondale.localhost}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?Set MYSQL_ROOT_PASSWORD (matches infra/.env)}"

# The bind-mounted app source is owned by root (Windows bind mount), which git
# (running as the frappe user) refuses to touch without this explicit opt-in.
git config --global --add safe.directory /home/frappe/edupro_school_fees-src

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

if [ ! -d apps/edupro_school_fees ]; then
	# edupro_school_fees-src is the whole project repo's working tree, bind-
	# mounted live from the host. --soft-link makes bench symlink straight to
	# it instead of git-cloning (which would only see committed history and
	# miss uncommitted working-tree edits) - edits on the host take effect
	# immediately, no reinstall needed.
	bench get-app --soft-link edupro_school_fees /home/frappe/edupro_school_fees-src
fi
bench --site "${SITE_NAME}" install-app edupro_school_fees

bench --site "${SITE_NAME}" set-config developer_mode 1
bench --site "${SITE_NAME}" migrate
bench use "${SITE_NAME}"

echo "Setup complete. Run: bench start --port 8000 (host 0.0.0.0 already bound via docker port mapping)"
