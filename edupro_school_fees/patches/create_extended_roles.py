# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Phase 4 internal RBAC: two new oversight roles. Both get desk_access=0 from
	creation -- every role except System Manager works through the custom Staff &
	Parent web app (Phase 4), not Frappe's Desk UI. See lock_down_desk_access.py for
	the roles created before that decision."""

	roles = ["SDC Chairperson/Treasurer", "District Education Auditor/Inspector"]

	for role_name in roles:
		if frappe.db.exists("Role", role_name):
			continue
		frappe.get_doc({
			"doctype": "Role",
			"role_name": role_name,
			"desk_access": 0,
		}).insert(ignore_permissions=True)
