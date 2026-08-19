import frappe, json

def run():
    out = {}
    out["global_defaults_currency"] = frappe.db.get_single_value("Global Defaults", "default_currency")
    out["walk_in_customer_currency"] = frappe.db.get_value("Customer", {"customer_name": ["like", "%Walk%"]}, ["name", "default_currency"], as_dict=True)
    country_meta = frappe.get_meta("Country")
    out["country_fields"] = [f.fieldname for f in country_meta.fields]
    out["company_country"] = frappe.db.get_value("Company", "Avondale Primary School", "country")
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
