import frappe, json
def run():
    meta = frappe.get_meta("Item")
    fields = [f.fieldname for f in meta.fields if 'uom' in f.fieldname.lower()]
    print("RESULT_JSON:" + json.dumps({"uom_fields": fields}))
run()
