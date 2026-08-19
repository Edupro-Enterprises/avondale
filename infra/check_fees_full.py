import frappe, json
def run():
    meta = frappe.get_meta("Fees")
    out = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "reqd": f.reqd, "default": f.default} for f in meta.fields]
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
