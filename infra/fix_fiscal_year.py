import frappe

def run():
    if not frappe.db.exists("Fiscal Year", "2026"):
        frappe.get_doc({
            "doctype": "Fiscal Year",
            "year": "2026",
            "year_start_date": "2026-01-01",
            "year_end_date": "2026-12-31",
        }).insert(ignore_permissions=True)
        print("RESULT: created Fiscal Year 2026")
    frappe.db.commit()

run()
