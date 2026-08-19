import frappe, json
def run():
    out = {}
    pes = frappe.get_all("Program Enrollment", filters={"program": "Grade 2"}, fields=["name", "student"])
    out["program_enrollment_count"] = len(pes)
    student_ids = [p.student for p in pes]
    out["fees_count"] = frappe.db.count("Fees", {"program": "Grade 2"}) if student_ids else 0
    out["fees_by_docstatus"] = frappe.db.sql("select docstatus, count(*) from `tabFees` where program='Grade 2' group by docstatus", as_dict=False)
    out["student_count_via_pe"] = len(set(student_ids))
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
