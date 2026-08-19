import frappe, json
def run():
    out = {}
    out["modes_of_payment"] = frappe.get_all("Mode of Payment", fields=["name"])
    fees_meta = frappe.get_meta("Fees")
    out["fees_all_fields"] = [f.fieldname for f in fees_meta.fields]
    out["has_payment_entry_doctype"] = frappe.db.exists("DocType", "Payment Entry")
    out["currency_exchange_count"] = frappe.db.count("Currency Exchange") if frappe.db.exists("DocType", "Currency Exchange") else "no doctype"
    out["currency_exchange_sample"] = frappe.get_all("Currency Exchange", limit_page_length=5, fields=["from_currency","to_currency","exchange_rate","date"])
    # Check if Fees doctype has any submit-time payment reconciliation controller method
    import inspect
    from education.education.doctype.fees.fees import Fees
    out["fees_controller_methods"] = [m for m in dir(Fees) if not m.startswith('_')]
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
