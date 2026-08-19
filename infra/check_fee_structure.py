import frappe
import json

def run():
    out = {}
    for dt in ["Fee Structure", "Fee Category", "Fee Component", "Fee Schedule", "Program Enrollment"]:
        meta = frappe.get_meta(dt)
        out[dt] = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "reqd": f.reqd} for f in meta.fields]
    out["funds"] = frappe.get_all("Fund", fields=["name", "fund_name", "fund_category"])
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
