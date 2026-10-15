# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Every role except System Manager works through the custom Staff & Parent web
	app (Phase 4), not Frappe's Desk UI -- create_roles.py's School Head/Bursar/Fees
	Approver predate that decision and were created with desk_access=1. Patches don't
	re-run once already applied, so a fresh patch is needed to fix roles already live
	in production; create_roles.py itself is also updated so a fresh install gets
	this right from the start."""

	roles_to_lock = ["School Head", "Bursar", "Fees Approver"]

	for role_name in roles_to_lock:
		if frappe.db.exists("Role", role_name):
			frappe.db.set_value("Role", role_name, "desk_access", 0)
