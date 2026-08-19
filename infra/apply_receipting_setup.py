import frappe, json, traceback

def run():
    out = {}
    try:
        from edupro_financials.install import (
            create_receipting_accounts_and_modes,
            create_payment_entry_custom_fields,
            grant_bursar_payment_permissions,
        )
        create_receipting_accounts_and_modes()
        create_payment_entry_custom_fields()
        grant_bursar_payment_permissions()
        frappe.db.commit()
        out["status"] = "ok"
        out["accounts"] = frappe.get_all("Account", filters={"name": ["in", ["Bank - APS", "Cash ZiG - APS"]]}, fields=["name","account_currency","is_group"])
        out["modes"] = frappe.get_all("Mode of Payment", fields=["name"])
    except Exception:
        out["status"] = "error"
        out["traceback"] = traceback.format_exc()
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
