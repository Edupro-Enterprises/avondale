import frappe

def run():
    frappe.db.set_default("currency", "USD")
    frappe.db.set_single_value("Global Defaults", "default_currency", "USD")
    frappe.db.commit()
    print("RESULT: currency defaults fixed to USD")

run()
