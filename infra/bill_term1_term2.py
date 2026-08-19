import frappe, json
from edupro_financials.billing import bill_term

def run():
    out = {}
    frappe.set_user("bursar@avondale.local")
    out["term1"] = bill_term("Grade 7", "2026", "2026 (Term 1 2026)", "2026-01-13")
    out["term2"] = bill_term("Grade 7", "2026", "2026 (Term 2 2026)", "2026-05-05")
    frappe.set_user("Administrator")
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
