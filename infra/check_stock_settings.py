import frappe
import json

def run():
    out = {}
    ss = frappe.get_single("Stock Settings")
    out["stock_uom"] = ss.stock_uom
    out["item_levy"] = frappe.db.get_value("Item", "Levy", "stock_uom") if frappe.db.exists("Item", "Levy") else None
    out["item_tuckshop"] = frappe.db.get_value("Item", "Tuckshop Sale", "stock_uom") if frappe.db.exists("Item", "Tuckshop Sale") else None
    out["fee_category_levy_exists"] = frappe.db.exists("Fee Category", "Levy")
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
