import frappe, json, traceback
def run():
    out = {}
    try:
        frappe.set_user("bursar@avondale.local")
        from edupro_financials.exchange_rate import set_daily_rate, get_today_rate
        out["set_result"] = set_daily_rate(0.055)
        frappe.set_user("Administrator")
        out["get_result"] = get_today_rate()
    except Exception:
        out["traceback"] = traceback.format_exc()
    finally:
        frappe.set_user("Administrator")
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
