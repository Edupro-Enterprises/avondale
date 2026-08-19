import frappe, json
def run():
    out = {}
    out["total_fees_count"] = frappe.db.count("Fees")
    out["term3_fees_count"] = frappe.db.count("Fees", {"academic_term": "Term 3 2026"})
    out["opening_balance_count"] = frappe.db.count("Fees", {"is_opening_balance": 1})

    abd24_student = frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")
    term3_fees = frappe.get_all("Fees", filters={"student": abd24_student, "academic_term": "Term 3 2026"}, fields=["fee_structure","fund","grand_total","due_date"])
    out["abd24_term3_fees"] = term3_fees

    out["total_billed_term3"] = frappe.db.sql("select sum(grand_total) from `tabFees` where academic_term='Term 3 2026'")[0][0]
    out["expected_term3_total"] = 158 * 170

    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
