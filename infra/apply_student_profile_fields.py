import frappe

def run():
    from edupro_financials.install import create_student_profile_fields
    create_student_profile_fields()
    frappe.clear_cache(doctype="Student")
    frappe.db.commit()
    print("RESULT: student profile fields created")

run()
