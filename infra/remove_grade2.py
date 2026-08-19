import frappe, json

def run():
    out = {"fees_cancelled_deleted": 0, "enrollments_deleted": 0, "students_deleted": 0, "errors": []}

    pes = frappe.get_all("Program Enrollment", filters={"program": "Grade 2"}, fields=["name", "student"])
    student_ids = list({p.student for p in pes})

    fees = frappe.get_all("Fees", filters={"program": "Grade 2"}, pluck="name")
    for f in fees:
        try:
            doc = frappe.get_doc("Fees", f)
            if doc.docstatus == 1:
                doc.cancel()
            frappe.delete_doc("Fees", f, force=True, ignore_permissions=True)
            out["fees_cancelled_deleted"] += 1
        except Exception as e:
            out["errors"].append({"stage": "fees", "name": f, "error": str(e)[:200]})

    for pe in pes:
        try:
            frappe.delete_doc("Program Enrollment", pe.name, force=True, ignore_permissions=True)
            out["enrollments_deleted"] += 1
        except Exception as e:
            out["errors"].append({"stage": "enrollment", "name": pe.name, "error": str(e)[:200]})

    for student in student_ids:
        try:
            user_email = frappe.db.get_value("Student", student, "student_email_id")
            frappe.delete_doc("Student", student, force=True, ignore_permissions=True)
            if user_email and frappe.db.exists("User", user_email):
                frappe.delete_doc("User", user_email, force=True, ignore_permissions=True)
            out["students_deleted"] += 1
        except Exception as e:
            out["errors"].append({"stage": "student", "name": student, "error": str(e)[:200]})

    frappe.db.commit()
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
