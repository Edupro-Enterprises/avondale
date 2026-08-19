import frappe, json, traceback

def run():
    out = {}
    try:
        student = frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")
        company = "Avondale Primary School"

        pe = frappe.get_doc({
            "doctype": "Payment Entry",
            "payment_type": "Receive",
            "party_type": "Student",
            "party": student,
            "company": company,
            "paid_from": "Debtors - APS",
            "paid_to": "Cash - APS",
            "paid_amount": 10,
            "received_amount": 10,
            "reference_no": "TEST-001",
            "reference_date": frappe.utils.nowdate(),
        })
        pe.insert(ignore_permissions=True)
        pe.submit()
        out["created"] = pe.name
        out["receipt_no"] = frappe.db.get_value("Payment Entry", pe.name, "receipt_no")

        # test cancellation requires reason
        try:
            pe2 = frappe.get_doc("Payment Entry", pe.name)
            pe2.cancel()
            out["cancel_without_reason"] = "UNEXPECTED SUCCESS"
        except Exception as e:
            out["cancel_without_reason"] = f"correctly blocked: {str(e)[:150]}"

        frappe.db.set_value("Payment Entry", pe.name, "cancellation_reason", "test cleanup")
        pe3 = frappe.get_doc("Payment Entry", pe.name)
        pe3.cancel()
        out["cancel_with_reason"] = "success"
        frappe.delete_doc("Payment Entry", pe.name, force=True, ignore_permissions=True)

    except Exception:
        out["traceback"] = traceback.format_exc()
    frappe.db.commit()
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
