import frappe, traceback

def run():
    frappe.set_user("bursar@avondale.local")
    try:
        from edupro_financials.igp_sales import create_sale
        result = create_sale("Tuckshop Sale", "trace test", 5.5, "Cash")
        print("RESULT: SUCCESS", result)
    except Exception:
        print("RESULT: TRACEBACK")
        print(traceback.format_exc())
    finally:
        frappe.set_user("Administrator")

run()
