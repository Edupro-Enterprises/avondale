import frappe, json
def run():
    out = {}
    out["fiscal_years"] = frappe.get_all("Fiscal Year", fields=["name", "year_start_date", "year_end_date"])
    out["expense_accounts"] = frappe.get_all("Account", filters={"root_type": "Expense", "is_group": 0}, fields=["name"])
    out["vote_book_allocations"] = frappe.get_all("Vote Book Allocation", fields=["name"])
    out["headmaster_roles"] = frappe.get_roles("headmaster@avondale.local")
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
