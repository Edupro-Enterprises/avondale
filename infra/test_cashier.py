import frappe, json, traceback

def run():
    out = {}
    try:
        frappe.set_user("bursar@avondale.local")
        from edupro_financials.cashier import get_till_context, close_till

        out["context_before"] = get_till_context()
        result = close_till(opening_float=50, usd_cash_counted=105.5, ecocash_batch_total=50, zipit_batch_total=0, zig_cash_counted=0)
        out["close_result"] = result
        out["context_after"] = get_till_context()

        # Try closing again same day - should reflect already_closed
        try:
            close_till(opening_float=0, usd_cash_counted=0)
            out["double_close"] = "UNEXPECTED SUCCESS - allowed a second close same day"
        except Exception as e:
            out["double_close"] = f"correctly rejected: {str(e)[:200]}"

        frappe.db.commit()
        print("RESULT_JSON:" + json.dumps(out, default=str))
    except Exception:
        print("RESULT: TRACEBACK")
        print(traceback.format_exc())
    finally:
        frappe.set_user("Administrator")

run()
