import frappe, json
def run():
    out = {}
    out["grade2_pe_count"] = frappe.db.count("Program Enrollment", {"program": "Grade 2"})
    out["grade2_fees_count"] = frappe.db.count("Fees", {"program": "Grade 2"})
    out["grade2_students_by_code"] = frappe.db.count("Student", {"pastel_account_code": ["like", "%"]})

    out["grade7_student_count"] = frappe.db.count("Program Enrollment", {"program": "Grade 7"})
    out["grade7_active_fees"] = frappe.db.count("Fees", {"program": "Grade 7", "docstatus": 1})

    from edupro_financials.oversight import get_summary
    frappe.set_user("headmaster@avondale.local")
    out["oversight_total_arrears"] = get_summary()["total_arrears_outstanding"]
    frappe.set_user("Administrator")

    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
