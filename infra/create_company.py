import frappe

def run():
    from erpnext.setup.setup_wizard.operations.install_fixtures import install as install_fixtures
    install_fixtures(country="Zimbabwe")
    frappe.db.commit()
    print("RESULT: fixtures installed")

    if not frappe.db.exists("Company", "Avondale Primary School"):
        company = frappe.get_doc({
            "doctype": "Company",
            "company_name": "Avondale Primary School",
            "abbr": "APS",
            "default_currency": "USD",
            "country": "Zimbabwe",
        })
        company.insert(ignore_permissions=True)
        frappe.db.set_single_value("Global Defaults", "default_company", company.name)
        frappe.db.commit()
        print("RESULT: Company created:", company.name)
    else:
        print("RESULT: Company already exists")
    print("RESULT: default_company =", frappe.db.get_single_value("Global Defaults", "default_company"))
    print("RESULT: Direct Income - APS exists:", frappe.db.exists("Account", "Direct Income - APS"))

run()
