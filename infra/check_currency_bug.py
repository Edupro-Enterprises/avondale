import frappe, json

def run():
    out = {}
    out["company_currency"] = frappe.db.get_value("Company", "Avondale Primary School", "default_currency")
    modes = frappe.get_all("Mode of Payment", fields=["name"])
    out["modes_of_payment"] = modes
    for m in modes:
        doc = frappe.get_doc("Mode of Payment", m.name)
        accounts = [{"company": a.company, "default_account": a.default_account} for a in doc.accounts]
        out.setdefault("mode_accounts", {})[m.name] = accounts
    out["debtors_currency"] = frappe.db.get_value("Account", "Debtors - APS", "account_currency")
    cash_accounts = frappe.get_all("Account", filters={"account_type": ["in", ["Cash","Bank"]]}, fields=["name", "account_currency"])
    out["cash_bank_accounts"] = cash_accounts
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
