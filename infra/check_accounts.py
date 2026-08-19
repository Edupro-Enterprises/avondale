import frappe
import json

def run():
    out = {}
    out["receivable_accounts"] = frappe.get_all("Account", filters={"account_type": "Receivable"}, fields=["name", "account_type"])
    out["income_accounts"] = frappe.get_all("Account", filters={"root_type": "Income", "is_group": 0}, fields=["name"])
    fees_meta = frappe.get_meta("Fees")
    out["fees_fields"] = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "reqd": f.reqd} for f in fees_meta.fields if "account" in f.fieldname.lower() or f.fieldname in ("fee_structure","program","academic_term","academic_year","student_batch")]
    out["company"] = frappe.db.get_single_value("Global Defaults", "default_company")
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
