import frappe
def run():
    from edupro_financials.install import create_payment_entry_custom_fields
    create_payment_entry_custom_fields()
    frappe.clear_cache()
    frappe.db.commit()
    print("RESULT: payment entry fields applied, cache cleared")
run()
