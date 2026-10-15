# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Phase 5.1 portal RBAC: the two self-service roles. Both get desk_access=0 --
	these users only ever reach the system through the custom web app, never Desk."""

	roles = ["Parent/Guardian", "Student"]

	for role_name in roles:
		if frappe.db.exists("Role", role_name):
			continue
		frappe.get_doc({
			"doctype": "Role",
			"role_name": role_name,
			"desk_access": 0,
		}).insert(ignore_permissions=True)
