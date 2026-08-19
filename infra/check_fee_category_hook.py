import frappe
import json

def run():
    out = {}
    meta = frappe.get_meta("Fee Category Default")
    out["fee_category_default_fields"] = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "reqd": f.reqd} for f in meta.fields]
    import inspect
    from education.education.doctype.fee_category.fee_category import create_item, update_item
    out["create_item_src"] = inspect.getsource(create_item)
    out["update_item_src"] = inspect.getsource(update_item)
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
