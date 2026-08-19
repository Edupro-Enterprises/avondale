import frappe, json
def run():
    out = {}
    from edupro_financials.edupro_financials.report.age_analyzed_fee_arrears_schedule.age_analyzed_fee_arrears_schedule import execute as arrears
    cols, data = arrears({"as_on_date": "2026-08-17"})
    out["arrears_report_rows"] = len(data)
    out["arrears_sample"] = data[:3]

    from edupro_financials.oversight import get_summary
    frappe.set_user("headmaster@avondale.local")
    out["oversight_summary"] = get_summary()
    frappe.set_user("Administrator")

    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
