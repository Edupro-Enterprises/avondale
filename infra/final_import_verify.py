import frappe, json
def run():
    out = {}
    out["student_count"] = frappe.db.count("Student")
    out["enrollment_count"] = frappe.db.count("Program Enrollment")
    out["fees_count"] = frappe.db.count("Fees")
    out["fees_submitted_count"] = frappe.db.count("Fees", {"docstatus": 1})

    out["abd24"] = frappe.db.get_value("Fees", {"student": frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")}, "grand_total")
    out["banw18"] = frappe.db.get_value("Fees", {"student": frappe.db.get_value("Student", {"pastel_account_code": "BANW18"}, "name")}, "grand_total")

    batch_counts = frappe.db.sql("""
        select student_batch_name, count(*) as cnt
        from `tabProgram Enrollment`
        where program = 'Grade 7' and academic_year = '2026'
        group by student_batch_name
        order by student_batch_name
    """, as_dict=True)
    out["batch_distribution"] = batch_counts

    out["total_sdc_balance"] = frappe.db.sql("select sum(grand_total) from `tabFees` where fee_structure='EDU-FST-2026-00017'")[0][0]

    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
