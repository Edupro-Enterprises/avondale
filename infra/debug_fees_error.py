import frappe, traceback

def run():
    try:
        student = frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")
        pe = frappe.db.get_value("Program Enrollment", {"student": student}, "name")
        fees_doc = frappe.get_doc({
            "doctype": "Fees",
            "student": student,
            "student_name": "Abdul Sharzan",
            "company": "Avondale Primary School",
            "posting_date": "2026-01-01",
            "due_date": "2026-01-01",
            "program_enrollment": pe,
            "program": "Grade 7",
            "academic_year": "2026",
            "fee_structure": "EDU-FST-2026-00017",
            "components": [{"fees_category": "Levy", "amount": 300}],
            "grand_total": 300,
            "receivable_account": "Debtors - APS",
            "fund": "SDC / SDA Fund",
            "student_batch": "7M",
            "is_opening_balance": 1,
        })
        fees_doc.insert(ignore_permissions=True)
        print("RESULT: SUCCESS", fees_doc.name)
    except Exception:
        print("RESULT: TRACEBACK")
        print(traceback.format_exc())

run()
