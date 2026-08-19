import frappe, json
def run():
    out = {}
    meta = frappe.get_meta("Student")
    out["student_fields"] = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "reqd": f.reqd} for f in meta.fields if f.reqd or f.fieldname in ("student_name","first_name","last_name","gender","date_of_birth")]
    meta2 = frappe.get_meta("Program Enrollment")
    out["pe_required"] = [f.fieldname for f in meta2.fields if f.reqd]
    # existing fee structures for Grade 7
    out["grade7_fee_structures"] = frappe.get_all("Fee Structure", filters={"program": "Grade 7"}, fields=["name", "fund"])
    for fs in out["grade7_fee_structures"]:
        fs["components"] = frappe.get_all("Fee Component", filters={"parent": fs["name"]}, fields=["fees_category","amount"])
    out["existing_student_count"] = frappe.db.count("Student")
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
