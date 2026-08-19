import frappe, json
def run():
    out = {}
    out["frappe_db_default_currency"] = frappe.db.get_default("currency")
    out["defaults_table_currency_rows"] = frappe.db.sql("select defkey, defvalue, parent from `tabDefaultValue` where defkey='currency'", as_dict=True)
    out["currencies_enabled"] = frappe.get_all("Currency", filters={"enabled": 1}, fields=["name"])
    out["zwl_exists"] = frappe.db.exists("Currency", "ZWL")
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
