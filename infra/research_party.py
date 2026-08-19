import frappe, json, inspect
def run():
    out = {}
    out["party_types"] = frappe.get_all("Party Type", fields=["name", "account_type"])
    from education.education.doctype.fees.fees import Fees
    out["get_party_src"] = inspect.getsource(Fees.get_party)
    accounts = frappe.get_all("Account", filters={"account_type": ["in", ["Cash","Bank"]]}, fields=["name","is_group","account_type","account_currency"])
    out["cash_bank_accounts_detail"] = accounts
    out["all_accounts_apс"] = frappe.get_all("Account", filters={"company": "Avondale Primary School", "parent_account": ["like", "%Bank%"]}, fields=["name","is_group"])
    print("RESULT_JSON:" + json.dumps(out, default=str))
run()
