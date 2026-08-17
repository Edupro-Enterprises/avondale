"""Backend support for the Edupro parent/staff portal (Astro, decoupled
from Desk). School-side roles (Headmaster, Bursar, SDC Chairperson,
Deputy Head) have desk_access=0 and user_type "Website User" - they can
never reach /app. This module is the thin session/identity bridge the
portal calls right after login to decide which page to route to.
"""

import frappe

PORTAL_ROLES = ["Headmaster", "Bursar", "SDC Chairperson", "Deputy Head"]


@frappe.whitelist()
def get_session_info():
	if frappe.session.user == "Guest":
		frappe.throw("Not logged in", frappe.AuthenticationError)

	user = frappe.get_doc("User", frappe.session.user)
	user_roles = {r.role for r in user.roles}
	portal_roles = [r for r in PORTAL_ROLES if r in user_roles]

	return {
		"user": user.name,
		"full_name": user.full_name,
		"roles": portal_roles,
		"primary_role": portal_roles[0] if portal_roles else None,
	}
