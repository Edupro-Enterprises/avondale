import frappe, json
def run():
    meta = frappe.get_meta("Fees")
    out = [{"fieldname": f.fieldname, "fetch_from": f.fetch_from} for f in meta.fields if f.fetch_from]
    print("RESULT_JSON:" + json.dumps(out))
    # also check Account doctype columns actually in DB
    cols = frappe.db.sql("show columns from `tabAccount`", as_dict=True)
    print("HAS_INCOME_ACCOUNT_COL:", any(c.get("Field")=="income_account" for c in cols))
run()
