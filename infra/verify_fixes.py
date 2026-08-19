import frappe, json
def run():
    out = {}
    cols = frappe.db.sql("show columns from `tabFee Structure`", as_dict=True)
    out["has_income_account_col"] = any(c.get("Field")=="income_account" for c in cols)
    out["fee_structure_income_accounts"] = frappe.get_all("Fee Structure", filters={"program":"Grade 7"}, fields=["name","income_account"])
    out["throttle_config"] = frappe.local.conf.get("throttle_user_limit")
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
