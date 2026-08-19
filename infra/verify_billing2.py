import frappe, json
def run():
    out = {}
    out["term3_fees_count"] = frappe.db.count("Fees", {"academic_term": "2026 (Term 3 2026)"})
    out["total_billed_term3"] = frappe.db.sql("select sum(grand_total) from `tabFees` where academic_term='2026 (Term 3 2026)'")[0][0]
    out["expected_term3_total"] = 158 * 170
    out["levy_count"] = frappe.db.count("Fees", {"academic_term": "2026 (Term 3 2026)", "fee_structure": "EDU-FST-2026-00017"})
    out["tuition_count"] = frappe.db.count("Fees", {"academic_term": "2026 (Term 3 2026)", "fee_structure": "EDU-FST-2026-00018"})
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
