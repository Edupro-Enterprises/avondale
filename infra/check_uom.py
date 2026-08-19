import frappe
import json

def run():
    out = {}
    out["uom_nos_exists"] = frappe.db.exists("UOM", "Nos")
    out["academic_year_2026_exists"] = frappe.db.exists("Academic Year", "2026")
    out["igp_items_stock_uom"] = frappe.db.sql("select item_code, stock_uom from `tabItem`", as_dict=True)
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
