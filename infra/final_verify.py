import frappe, json

def run():
    out = {}
    out["fee_structure_count"] = frappe.db.count("Fee Structure")
    out["program_count"] = frappe.db.count("Program")
    out["student_batch_count"] = frappe.db.count("Student Batch Name")
    out["sample_levy"] = frappe.db.get_value(
        "Fee Structure",
        {"program": "Grade 7"},
        ["program", "fund"],
        as_dict=True,
    )
    fs_grade7 = frappe.get_all("Fee Structure", filters={"program": "Grade 7"}, fields=["name", "fund", "total_amount"])
    out["grade7_fee_structures"] = fs_grade7
    out["grade7_components"] = []
    for fs in fs_grade7:
        comps = frappe.get_all("Fee Component", filters={"parent": fs.name}, fields=["fees_category", "amount"])
        out["grade7_components"].append({"structure": fs.name, "components": comps})
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
