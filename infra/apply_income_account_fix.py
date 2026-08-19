import frappe

def run():
    from edupro_financials.install import create_fee_structure_income_account_field
    create_fee_structure_income_account_field()
    frappe.clear_cache(doctype="Fee Structure")

    # Populate on all existing Fee Structures, matching each fee category's
    # dedicated income account (mirrors the Item defaults already set up).
    category_income_account = {"Levy": "Levy Income - APS", "Tuition": "Tuition Income - APS"}
    for fs_name in frappe.get_all("Fee Structure", pluck="name"):
        categories = frappe.get_all("Fee Component", filters={"parent": fs_name}, pluck="fees_category")
        if categories and categories[0] in category_income_account:
            frappe.db.set_value("Fee Structure", fs_name, "income_account", category_income_account[categories[0]])

    frappe.db.commit()
    print("RESULT: income_account field added and populated")

run()
