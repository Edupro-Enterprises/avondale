import frappe, json
def run():
    out = {}
    abd24 = frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")
    all_fees = frappe.get_all("Fees", filters={"student": abd24}, fields=["name","fee_structure","academic_term","grand_total","is_opening_balance"])
    out["abd24_all_fees"] = all_fees
    out["distinct_academic_terms"] = frappe.db.sql("select distinct academic_term from `tabFees`", as_dict=True)
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
