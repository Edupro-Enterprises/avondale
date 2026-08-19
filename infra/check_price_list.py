import frappe, json
def run():
    out = {}
    out["price_lists"] = frappe.get_all("Price List", fields=["name", "currency", "selling", "enabled"])
    out["default_selling_price_list_global"] = frappe.db.get_single_value("Selling Settings", "selling_price_list")
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
