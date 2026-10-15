"""Settings > Backup page. Frappe's own backup tooling
(frappe.utils.backups.new_backup / fetch_latest_backups) is hard-gated to
System Manager -- these wrappers relax that to the same internal-role set
used by every report in reports.py, matching this app's established pattern
of relaxing Frappe defaults for its own role model (verify_receipt,
get_ageing_summary, etc.).

Also registers a scheduled daily backup (see hooks.py's scheduler_events),
reusing the same Frappe scheduler this app already runs debtor-ageing
escalation and asset depreciation through -- no new infra."""

import os
from datetime import datetime

import frappe
from frappe.utils import get_site_path
from frappe.utils.backups import new_backup

_ALLOWED_ROLES = {"Bursar", "School Head", "System Manager"}

# Real filenames from frappe.utils.backups.new_backup(), confirmed live:
# "<timestamp>-<site_with_underscores>-database.sql.gz" (+ -files.tar,
# -private-files.tar, -site_config_backup.json). Stripping whichever of
# these suffixes matches gives the shared "backup set" key so retention can
# prune a whole run's files together, not just the oldest individual file.
_BACKUP_FILE_SUFFIXES = [
	"-database.sql.gz", "-database.enc.sql.gz",
	"-files.tar", "-files.enc.tar",
	"-private-files.tar", "-private-files.enc.tar",
	"-site_config_backup.json",
]

RETENTION_COUNT = 30


def _require_admin_role():
	if not _ALLOWED_ROLES & set(frappe.get_roles(frappe.session.user)):
		frappe.throw("Not permitted to manage backups.", frappe.PermissionError)


def _backup_dir():
	path = get_site_path("private", "backups")
	os.makedirs(path, exist_ok=True)
	return path


def _backup_set_key(filename):
	for suffix in _BACKUP_FILE_SUFFIXES:
		if filename.endswith(suffix):
			return filename[: -len(suffix)]
	return filename


def _prune_old_backups():
	"""Keeps the most recent RETENTION_COUNT backup sets (a "set" being every
	file sharing one run's timestamp prefix) and deletes the rest, so a daily
	schedule doesn't grow the backups directory forever."""
	backup_dir = _backup_dir()
	sets = {}
	for name in os.listdir(backup_dir):
		full_path = os.path.join(backup_dir, name)
		if not os.path.isfile(full_path):
			continue
		key = _backup_set_key(name)
		sets.setdefault(key, {"mtime": 0, "files": []})
		sets[key]["files"].append(name)
		sets[key]["mtime"] = max(sets[key]["mtime"], os.stat(full_path).st_mtime)

	ordered = sorted(sets.items(), key=lambda kv: kv[1]["mtime"], reverse=True)
	for _key, info in ordered[RETENTION_COUNT:]:
		for name in info["files"]:
			os.remove(os.path.join(backup_dir, name))


def _run_backup():
	backup = new_backup(ignore_files=False)
	_prune_old_backups()
	return {
		"database": os.path.basename(backup.backup_path_db),
		"files": os.path.basename(backup.backup_path_files) if backup.backup_path_files else None,
		"private_files": os.path.basename(backup.backup_path_private_files) if backup.backup_path_private_files else None,
	}


@frappe.whitelist()
def list_backups():
	_require_admin_role()
	backup_dir = _backup_dir()
	files = []
	for name in os.listdir(backup_dir):
		full_path = os.path.join(backup_dir, name)
		if not os.path.isfile(full_path):
			continue
		stat = os.stat(full_path)
		files.append({
			"filename": name,
			"size": stat.st_size,
			# frappe.utils.get_datetime() doesn't accept a raw epoch float --
			# it silently returns None (confirmed live: crashed this endpoint
			# with a 500 on every call, a pre-existing bug, not introduced by
			# the scheduling work in this same file).
			"modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
		})
	return sorted(files, key=lambda f: f["modified"], reverse=True)


@frappe.whitelist()
def run_backup():
	"""Full database + files backup, run synchronously -- a manual "Backup
	now" click, on top of the daily scheduled one below."""
	_require_admin_role()
	return _run_backup()


def scheduled_backup():
	"""Registered under hooks.py's scheduler_events["cron"]["0 2 * * *"] --
	runs as the scheduler's own system context, not a real user request, so
	no _require_admin_role() check (there's no frappe.session.user to check
	here the way there is for a real whitelisted call)."""
	_run_backup()


@frappe.whitelist()
def download_backup(filename):
	"""filename must be an exact entry from this site's own backup directory
	listing -- no path traversal is possible since os.listdir() never yields
	'../' style entries, and this only ever opens a name it just enumerated
	itself."""
	_require_admin_role()
	backup_dir = _backup_dir()
	if filename not in os.listdir(backup_dir):
		frappe.throw("Backup file not found.")
	with open(os.path.join(backup_dir, filename), "rb") as f:
		frappe.local.response.filename = filename
		frappe.local.response.filecontent = f.read()
		frappe.local.response.type = "download"
