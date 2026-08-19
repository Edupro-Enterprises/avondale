import frappe, json

def run():
    out = {}

    # Cancel + delete the test Sales Invoice (IGP sale)
    if frappe.db.exists("Sales Invoice", "ACC-SINV-2026-00001"):
        doc = frappe.get_doc("Sales Invoice", "ACC-SINV-2026-00001")
        doc.cancel()
        frappe.delete_doc("Sales Invoice", "ACC-SINV-2026-00001", force=True, ignore_permissions=True)
        out["sales_invoice"] = "cancelled + deleted"

    # Cancel + delete the test Purchase Order
    if frappe.db.exists("Purchase Order", "PUR-ORD-2026-00001"):
        doc = frappe.get_doc("Purchase Order", "PUR-ORD-2026-00001")
        doc.cancel()
        frappe.delete_doc("Purchase Order", "PUR-ORD-2026-00001", force=True, ignore_permissions=True)
        out["purchase_order"] = "cancelled + deleted"

    # Cancel + delete the test Daily Cashier Reconciliation
    dcr_name = "DCR-bursar@avondale.local-2026-08-17"
    if frappe.db.exists("Daily Cashier Reconciliation", dcr_name):
        doc = frappe.get_doc("Daily Cashier Reconciliation", dcr_name)
        doc.cancel()
        frappe.delete_doc("Daily Cashier Reconciliation", dcr_name, force=True, ignore_permissions=True)
        out["cashier_reconciliation"] = "cancelled + deleted"

    # Delete test Vote Book Allocation and Supplier
    for name in frappe.get_all("Vote Book Allocation", filters={"expense_account": "Print and Stationery - APS"}, pluck="name"):
        frappe.delete_doc("Vote Book Allocation", name, force=True, ignore_permissions=True)
        out["vote_book_allocation"] = "deleted"

    if frappe.db.exists("Supplier", "Test Stationery Supplier"):
        frappe.delete_doc("Supplier", "Test Stationery Supplier", force=True, ignore_permissions=True)
        out["supplier"] = "deleted"

    frappe.db.commit()
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
