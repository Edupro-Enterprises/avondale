import frappe, json, traceback

def run():
    out = {}
    try:
        student = frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")
        frappe.set_user("bursar@avondale.local")
        from edupro_financials.receipting import get_student_account, receipt_payment

        out["account_before"] = get_student_account(student)

        # Pay exactly 170 USD cash - should cover Term1 Levy(150) + Term1 Tuition(20), splitting funds automatically
        result = receipt_payment(student, 170, "Cash", reference_no="TEST-RECEIPT-1", terminal="HAR")
        out["payment_result"] = result

        out["account_after"] = get_student_account(student)

        # GL check on the payment entry
        gl = frappe.get_all("GL Entry", filters={"voucher_no": result["payment_entry"]}, fields=["account","debit","credit","fund"])
        out["gl_entries"] = gl

        frappe.set_user("Administrator")
    except Exception:
        out["traceback"] = traceback.format_exc()
        frappe.set_user("Administrator")
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
