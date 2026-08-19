import frappe, json
def run():
    meta = frappe.get_meta("Payment Entry Reference")
    out = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "reqd": f.reqd} for f in meta.fields]
    pe_meta = frappe.get_meta("Payment Entry")
    out2 = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "reqd": f.reqd} for f in pe_meta.fields if f.fieldname in ("paid_amount","received_amount","source_exchange_rate","target_exchange_rate","paid_from_account_currency","paid_to_account_currency","unallocated_amount","base_paid_amount","difference_amount")]
    print("RESULT_JSON:" + json.dumps({"references": out, "pe_fields": out2}))
run()
