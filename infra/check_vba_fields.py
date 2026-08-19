import frappe, json
def run():
    meta = frappe.get_meta("Vote Book Allocation")
    print("RESULT_JSON:" + json.dumps([{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "reqd": f.reqd} for f in meta.fields]))
run()
