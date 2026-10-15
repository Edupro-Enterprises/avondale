# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""DEF-030: System Manager -- the sole Desk-access role under this app's
	architecture, and so the highest-value target on the system -- was
	deliberately left out of enable_mfa_for_privileged_roles.py, on the
	stated concern that this app's own deploy/ops workflow depends on
	frictionless Administrator login and 2FA's email round-trip couldn't be
	verified from an automated environment.

	Re-examined: Frappe's 2FA only ever gates the web `/api/method/login`
	flow (frappe.twofactor.two_factor_is_enabled_for_, checked from
	LoginManager.authenticate) -- it has no effect on `bench` CLI commands
	run directly against the site (migrate, run-tests, console, this
	project's own hot-patch workflow), which never go through that endpoint.
	Only a human logging into the Desk UI via a browser is challenged, which
	is now a rare, high-privilege path worth the friction -- and it remains
	reachable via `bench` even if email OTP delivery is ever unavailable.
	"""
	if frappe.db.exists("Role", "System Manager"):
		frappe.db.set_value("Role", "System Manager", "two_factor_auth", 1)
