import frappe, json
def run():
    fs = frappe.get_all("Fee Structure", filters={"program": "Grade 2"}, fields=["name", "fund"])
    for f in fs:
        f["components"] = frappe.get_all("Fee Component", filters={"parent": f["name"]}, pluck="fees_category")
    print("RESULT_JSON:" + json.dumps(fs))
run()
