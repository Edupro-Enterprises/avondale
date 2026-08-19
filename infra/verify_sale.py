import frappe, json
def run():
    out = {}
    si = frappe.db.get_value("Sales Invoice", "ACC-SINV-2026-00001", ["fund", "receipt_no", "grand_total", "docstatus", "terminal"], as_dict=True)
    out["sales_invoice"] = si
    out["gl_entries"] = frappe.get_all("GL Entry", filters={"voucher_no": "ACC-SINV-2026-00001"}, fields=["account", "debit", "credit", "fund"])
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
