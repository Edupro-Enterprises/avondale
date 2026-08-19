import frappe, json
def run():
    gl = frappe.get_all("GL Entry", filters={"voucher_no": "ACC-PAY-2026-00001"}, fields=["name","account","debit","credit","fund","against_voucher_type","against_voucher","is_cancelled","creation"])
    print("RESULT_JSON:" + json.dumps(gl, default=str))
run()
