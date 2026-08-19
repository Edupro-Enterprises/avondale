import frappe
import json

def run():
    out = {}
    out["fee_structures"] = frappe.get_all("Fee Structure", fields=["name", "program", "total_amount"])
    out["fee_categories"] = frappe.get_all("Fee Category", fields=["name"])
    out["fee_schedules"] = frappe.get_all("Fee Schedule", fields=["name", "program", "total_amount"]) if frappe.db.exists("DocType", "Fee Schedule") else []
    out["items_with_price"] = frappe.db.sql("""
        select i.item_code, i.item_group, ip.price_list_rate, ip.currency
        from `tabItem` i
        left join `tabItem Price` ip on ip.item_code = i.item_code
        order by i.item_code
    """, as_dict=True)
    out["programs"] = frappe.get_all("Program", fields=["name"]) if frappe.db.exists("DocType", "Program") else []
    out["fees_records"] = frappe.db.count("Fees") if frappe.db.exists("DocType", "Fees") else "no doctype"
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
