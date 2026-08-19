import frappe, json
def run():
    out = {}
    cols = frappe.db.sql("show columns from `tabStudent`", as_dict=True)
    fieldnames = [c["Field"] for c in cols]
    out["has_new_fields"] = all(f in fieldnames for f in ["emergency_contact_name","emergency_contact_phone","allergies","medical_conditions","sports_and_clubs","academic_notes"])
    try:
        from edupro_financials.student_profile import get_student_profile
        out["module_import"] = "ok"
    except Exception as e:
        out["module_import"] = str(e)
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
