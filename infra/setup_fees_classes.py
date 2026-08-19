import frappe

def run():
    company = frappe.db.get_single_value("Global Defaults", "default_company")

    # Backfill the pre-existing IGP/procurement items created via
    # ignore_mandatory=True (see edupro_financials/install.py fix) - without
    # this, any normal .save() on them would hit MandatoryError (stock_uom, uoms).
    for item_code in frappe.get_all("Item", pluck="name"):
        item = frappe.get_doc("Item", item_code)
        changed = False
        if not item.stock_uom:
            item.stock_uom = "Nos"
            changed = True
        if not item.uoms:
            item.append("uoms", {"uom": "Nos", "conversion_factor": 1})
            changed = True
        if changed:
            item.save(ignore_permissions=True)
            print(f"RESULT: backfilled stock_uom/uoms on Item {item_code}")

    # 1. Academic Year + Terms
    if not frappe.db.exists("Academic Year", "2026"):
        frappe.get_doc({
            "doctype": "Academic Year",
            "academic_year_name": "2026",
            "year_start_date": "2026-01-01",
            "year_end_date": "2026-12-31",
        }).insert(ignore_permissions=True)
        print("RESULT: created Academic Year 2026")

    terms = [
        ("Term 1 2026", "2026-01-13", "2026-04-03"),
        ("Term 2 2026", "2026-05-05", "2026-08-14"),
        ("Term 3 2026", "2026-09-08", "2026-12-04"),
    ]
    for term_name, start, end in terms:
        if not frappe.db.exists("Academic Term", term_name):
            frappe.get_doc({
                "doctype": "Academic Term",
                "academic_year": "2026",
                "term_name": term_name,
                "title": term_name,
                "term_start_date": start,
                "term_end_date": end,
            }).insert(ignore_permissions=True)
            print(f"RESULT: created Academic Term {term_name}")

    # 2. Income accounts for the two fee categories, parented like the IGP accounts.
    for acc_name, label in [("Levy Income - APS", "Levy Income"), ("Tuition Income - APS", "Tuition Income")]:
        if not frappe.db.exists("Account", acc_name):
            frappe.get_doc({
                "doctype": "Account",
                "account_name": label,
                "parent_account": "Direct Income - APS",
                "company": company,
                "is_group": 0,
                "root_type": "Income",
            }).insert(ignore_permissions=True)
            print(f"RESULT: created Account {acc_name}")

    # 3. Pre-create the two backing Items fully valid (item_group "Fee
    # Component", matching what education's Fee Category.create_item() would
    # build) so its after_insert hook finds them already valid and skips
    # straight to reuse instead of a bare .insert()/.save() that's missing
    # stock_uom/uoms.
    for cat_name, income_account in [("Levy", "Levy Income - APS"), ("Tuition", "Tuition Income - APS")]:
        if not frappe.db.exists("Item", cat_name):
            frappe.get_doc({
                "doctype": "Item",
                "item_code": cat_name,
                "item_name": cat_name,
                "item_group": "Fee Component",
                "is_stock_item": 0,
                "is_sales_item": 1,
                "is_service_item": 1,
                "stock_uom": "Nos",
                "uoms": [{"uom": "Nos", "conversion_factor": 1}],
                "item_defaults": [{"company": company, "income_account": income_account}],
            }).insert(ignore_permissions=True)
            print(f"RESULT: created Item {cat_name}")

    # 4. Fee Categories - after_insert finds the Item above already valid, so
    # its create_item()/update_item() round-trip just reuses and re-saves it
    # cleanly instead of failing on missing mandatory fields.
    for cat_name, income_account in [("Levy", "Levy Income - APS"), ("Tuition", "Tuition Income - APS")]:
        if not frappe.db.exists("Fee Category", cat_name):
            frappe.get_doc({
                "doctype": "Fee Category",
                "category_name": cat_name,
                "item_defaults": [{"company": company, "income_account": income_account}],
            }).insert(ignore_permissions=True)
            print(f"RESULT: created Fee Category {cat_name}")

    # 5. Programs (ECD A/B, Grade 1-7).
    programs = ["ECD A", "ECD B"] + [f"Grade {n}" for n in range(1, 8)]
    for prog in programs:
        if not frappe.db.exists("Program", prog):
            frappe.get_doc({
                "doctype": "Program",
                "program_name": prog,
            }).insert(ignore_permissions=True)
            print(f"RESULT: created Program {prog}")

    # 6. Student Batch Name (classes) per the confirmed stream layout.
    classes_by_program = {
        "ECD A": ["ECDA1", "ECDA2", "ECDA3", "ECDA4"],
        "ECD B": ["ECDB1", "ECDB2", "ECDB3", "ECDB4"],
        "Grade 1": ["1L", "1N", "1M", "1P"],
        "Grade 2": ["2L", "2N", "2M", "2P"],
        "Grade 3": ["3L", "3N", "3M", "3P"],
        "Grade 4": ["4L", "4N", "4M", "4P", "4K"],
        "Grade 5": ["5L", "5N", "5M", "5P"],
        "Grade 6": ["6L", "6N", "6M", "6P", "6K"],
        "Grade 7": ["7L", "7N", "7M", "7P"],
    }
    all_classes = [c for classes in classes_by_program.values() for c in classes]
    created_classes = 0
    for cls in all_classes:
        if not frappe.db.exists("Student Batch Name", cls):
            frappe.get_doc({
                "doctype": "Student Batch Name",
                "batch_name": cls,
            }).insert(ignore_permissions=True)
            created_classes += 1
    print(f"RESULT: created {created_classes} Student Batch Name records ({len(all_classes)} total)")

    # 7. Fee Structures: one Levy + one Tuition per Program, so each posts to its
    # correct fund (Fee Structure.fund is the single source the Fund accounting
    # dimension is fetched from - see edupro_financials/install.py:create_fees_fund_field).
    fee_specs = [
        ("Levy", 150, "SDC / SDA Fund"),
        ("Tuition", 20, "Tuition / General Government Fund"),
    ]
    created = 0
    for prog in programs:
        existing_fs_names = frappe.get_all(
            "Fee Structure", filters={"program": prog, "academic_year": "2026"}, pluck="name"
        )
        existing_categories = set()
        for fs_name in existing_fs_names:
            existing_categories.update(
                frappe.get_all("Fee Component", filters={"parent": fs_name}, pluck="fees_category")
            )
        for category, amount, fund in fee_specs:
            if category in existing_categories:
                continue
            frappe.get_doc({
                "doctype": "Fee Structure",
                "program": prog,
                "academic_year": "2026",
                "company": company,
                "receivable_account": "Debtors - APS",
                "fund": fund,
                "components": [{"fees_category": category, "amount": amount}],
            }).insert(ignore_permissions=True)
            created += 1
    print(f"RESULT: created {created} Fee Structures")

    frappe.db.commit()
    print("RESULT: DONE")

run()
