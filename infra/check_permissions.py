import frappe, json
def run():
    out = {}
    for user in ["headmaster@avondale.local", "sdc@avondale.local", "bursar@avondale.local"]:
        out[user] = {
            "Purchase Order.create": frappe.has_permission("Purchase Order", "create", user=user),
            "Sales Invoice.create": frappe.has_permission("Sales Invoice", "create", user=user),
            "Daily Cashier Reconciliation.create": frappe.has_permission("Daily Cashier Reconciliation", "create", user=user),
            "Student Exemption and Discount.create": frappe.has_permission("Student Exemption and Discount", "create", user=user),
        }
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
