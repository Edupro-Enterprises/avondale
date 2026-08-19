import frappe, json

def run():
    out = {}
    for r in ["Trial Balance", "Cash Flow Statement", "Statement of Changes in Net Assets"]:
        out[r] = frappe.db.exists("Report", r)
    print("RESULT_JSON:" + json.dumps(out))

run()
