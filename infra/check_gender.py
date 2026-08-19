import frappe, json
def run():
    print("RESULT_JSON:" + json.dumps({"genders": frappe.get_all("Gender", pluck="name")}))
run()
