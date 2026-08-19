import frappe, traceback

def run():
    try:
        student_doc = frappe.get_doc({
            "doctype": "Student",
            "first_name": "Washe",
            "last_name": "Kadenhere",
            "student_name": "Kadenhere Washe",
            "student_email_id": "kan25@pastel.import.local",
            "pastel_account_code": "KAN25",
        })
        student_doc.insert(ignore_permissions=True)
        print("RESULT: SUCCESS", student_doc.name)
    except Exception:
        print("RESULT: TRACEBACK")
        print(traceback.format_exc())

run()
