# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Enables Frappe's own built-in 2FA (frappe.twofactor) rather than building
	a custom OTP mechanism -- System Settings.enable_two_factor_auth is the
	global switch, and it only actually challenges a given login if at least
	one of that user's roles has Role.two_factor_auth set (frappe.twofactor.
	two_factor_is_enabled_for_()), so this is genuinely scoped to privileged
	internal roles, not every user.

	System Manager (and so Administrator, who holds it by default) is
	deliberately left OUT of this list -- this app is managed entirely through
	Administrator/System Manager, and this patch has no way to verify a real
	OTP email round-trip from inside an automated deploy. Locking out the one
	account every other fix in this app depends on would be a far worse
	outcome than a School Head needing to check their email once at login.
	"""
	privileged_roles = [
		"Bursar", "School Head", "SDC Chairperson/Treasurer",
		"Fees Approver", "District Education Auditor/Inspector",
	]
	for role_name in privileged_roles:
		if frappe.db.exists("Role", role_name):
			frappe.db.set_value("Role", role_name, "two_factor_auth", 1)

	# frappe.db.set_single_value updates just these two fields directly, rather
	# than loading and saving the whole System Settings singleton -- a full
	# .save() re-validates every mandatory field on the doc (language,
	# time_zone, ...), which can fail here for reasons entirely unrelated to
	# 2FA if any of them were never explicitly set.
	frappe.db.set_single_value("System Settings", "enable_two_factor_auth", 1)
	frappe.db.set_single_value("System Settings", "two_factor_method", "Email")
