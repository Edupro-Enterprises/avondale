import frappe

USERS = [
    ("bursar@avondale.local", "Bursar", "Bursar"),
    ("headmaster@avondale.local", "Headmaster", "Headmaster"),
    ("sdc@avondale.local", "SDC Chairperson", "SDC Chairperson"),
]
PASSWORD = "Avondale2026!"

def run():
    for email, full_name, role in USERS:
        if frappe.db.exists("User", email):
            u = frappe.get_doc("User", email)
            u.new_password = PASSWORD
            existing_roles = {r.role for r in u.roles}
            if role not in existing_roles:
                u.append("roles", {"role": role})
            u.enabled = 1
            u.save(ignore_permissions=True)
            print(f"RESULT: updated {email} ({role})")
        else:
            u = frappe.get_doc({
                "doctype": "User",
                "email": email,
                "first_name": full_name,
                "user_type": "Website User",
                "send_welcome_email": 0,
                "enabled": 1,
                "new_password": PASSWORD,
                "roles": [{"role": role}],
            })
            u.insert(ignore_permissions=True)
            print(f"RESULT: created {email} ({role})")
    frappe.db.commit()

    for email, _full_name, role in USERS:
        u = frappe.get_doc("User", email)
        roles = [r.role for r in u.roles]
        print(f"RESULT: {email} user_type={u.user_type} enabled={u.enabled} roles={roles}")

run()
