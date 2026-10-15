# Copyright (c) 2024, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
    """Create required roles for Edupro School Fees system"""
    
    # desk_access=0 -- every role except System Manager works through the custom
    # Staff & Parent web app (Phase 4), not Frappe's Desk UI.
    roles = [
        {"role_name": "School Head", "desk_access": 0},
        {"role_name": "Bursar", "desk_access": 0},
        {"role_name": "Fees Approver", "desk_access": 0}
    ]
    
    for role_data in roles:
        if not frappe.db.exists("Role", role_data["role_name"]):
            role = frappe.get_doc({
                "doctype": "Role",
                "role_name": role_data["role_name"],
                "desk_access": role_data["desk_access"]
            })
            role.insert(ignore_permissions=True)
            frappe.db.commit()
            print(f"Created role: {role_data['role_name']}")
        else:
            print(f"Role already exists: {role_data['role_name']}")
