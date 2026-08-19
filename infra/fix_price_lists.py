import frappe

def run():
    for name, selling, buying in [("Standard Selling", 1, 0), ("Standard Buying", 0, 1)]:
        if not frappe.db.exists("Price List", name):
            frappe.get_doc({
                "doctype": "Price List",
                "price_list_name": name,
                "currency": "USD",
                "selling": selling,
                "buying": buying,
                "enabled": 1,
            }).insert(ignore_permissions=True)
            print(f"RESULT: created Price List {name}")
    frappe.db.set_single_value("Selling Settings", "selling_price_list", "Standard Selling")
    if frappe.db.exists("DocType", "Buying Settings"):
        frappe.db.set_single_value("Buying Settings", "buying_price_list", "Standard Buying")
    frappe.db.commit()
    print("RESULT: DONE")

run()
