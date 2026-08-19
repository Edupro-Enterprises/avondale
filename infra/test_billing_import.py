import frappe
try:
    from edupro_financials.billing import preview_term_bill, bill_term, get_billing_options
    print("RESULT: import ok")
except Exception as e:
    print("RESULT: import failed", str(e))
