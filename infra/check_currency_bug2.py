import frappe, json

def run():
    out = {}
    out["global_defaults_currency"] = frappe.db.get_single_value("Global Defaults", "default_currency")
    out["walk_in_customer_currency"] = frappe.db.get_value("Customer", {"customer_name": ["like", "%Walk%"]}, ["name", "default_currency"], as_dict=True)
    out["country_zimbabwe_currency"] = frappe.db.get_value("Country", "Zimbabwe", "currency") if frappe.db.exists("Country","Zimbabwe") else None
    out["company_country"] = frappe.db.get_value("Company", "Avondale Primary School", "country")
    from erpnext.setup.utils import get_exchange_rate
    try:
        out["exchange_rate_test"] = get_exchange_rate("ZWL", "USD")
    except Exception as e:
        out["exchange_rate_test_error"] = str(e)
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
