import frappe
import json

def run():
    meta = frappe.get_meta("Program Enrollment")
    field = meta.get_field("student_batch_name")
    out = {
        "student_batch_name_field": {"fieldtype": field.fieldtype, "options": field.options} if field else None,
        "student_batch_name_records": frappe.get_all("Student Batch Name", fields=["name"]) if frappe.db.exists("DocType", "Student Batch Name") else "no doctype",
        "program_records": frappe.get_all("Program", fields=["name", "program_name"]),
        "academic_year_records": frappe.get_all("Academic Year", fields=["name", "academic_year_name", "year_start_date", "year_end_date"]),
        "academic_term_records": frappe.get_all("Academic Term", fields=["name", "term_name", "academic_year"]),
        "fee_category_records": frappe.get_all("Fee Category", fields=["name"]),
    }
    sbn_meta = frappe.get_meta("Student Batch Name")
    out["student_batch_name_fields"] = [f.fieldname for f in sbn_meta.fields]
    prog_meta = frappe.get_meta("Program")
    out["program_fields"] = [f.fieldname for f in prog_meta.fields]
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
