import frappe, json
def run():
    meta = frappe.get_meta("Currency Exchange")
    print("RESULT_JSON:" + json.dumps([{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "reqd": f.reqd} for f in meta.fields]))
run()
