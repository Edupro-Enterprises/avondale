import frappe, json
def run():
    out = {}
    meta = frappe.get_meta("Student")
    out["student_fields"] = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "label": f.label} for f in meta.fields]
    for dt in ["Guardian", "Student Guardian", "Student Sibling", "Student Log", "Student Group"]:
        if frappe.db.exists("DocType", dt):
            m = frappe.get_meta(dt)
            out[dt + "_fields"] = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options} for f in m.fields]
        else:
            out[dt + "_fields"] = "DOCTYPE NOT FOUND"
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
