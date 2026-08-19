import frappe

def run():
    frappe.db.set_single_value("System Settings", "setup_complete", 1)
    frappe.db.set_default("desk_setup_complete", "1")
    frappe.db.commit()
    print("RESULT: setup marked complete")

run()
