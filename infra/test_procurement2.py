import frappe, json, traceback

def run():
    out = {}
    try:
        if not frappe.db.exists("Vote Book Allocation", {"expense_account": "Print and Stationery - APS", "fund_category": "SDC / SDA", "fiscal_year": "2026"}):
            frappe.get_doc({
                "doctype": "Vote Book Allocation",
                "fiscal_year": "2026",
                "fund_category": "SDC / SDA",
                "expense_account": "Print and Stationery - APS",
                "approved_budget": 100,
            }).insert(ignore_permissions=True)
            frappe.db.commit()
        out["allocation_created"] = True

        frappe.set_user("bursar@avondale.local")
        from edupro_financials.procurement import create_supplier, create_requisition, submit_requisition, get_vote_book_balance

        supplier = create_supplier("Test Stationery Supplier")

        # SUCCESS PATH: within the $100 budget
        po_name = create_requisition(
            supplier=supplier, fiscal_year="2026", schedule_date="2026-09-01",
            items=[{"description": "Test stationery - within budget", "expense_account": "Print and Stationery - APS", "funding_category": "SDC / SDA", "rate": 40}],
        )
        out["success_path_po"] = po_name
        out["balance_after_draft"] = get_vote_book_balance("Print and Stationery - APS", "SDC / SDA", "2026")

        submitted = submit_requisition(po_name)
        out["submitted"] = submitted
        out["balance_after_submit"] = get_vote_book_balance("Print and Stationery - APS", "SDC / SDA", "2026")

        # OVERRUN PATH: only $60 left (100 - 40 committed), try to request $75
        try:
            create_requisition(
                supplier=supplier, fiscal_year="2026", schedule_date="2026-09-01",
                items=[{"description": "Test stationery - overrun", "expense_account": "Print and Stationery - APS", "funding_category": "SDC / SDA", "rate": 75}],
            )
            out["overrun_path"] = "UNEXPECTED SUCCESS - should have been rejected"
        except Exception as e:
            out["overrun_path"] = f"correctly rejected: {str(e)[:200]}"

        frappe.db.commit()
        print("RESULT_JSON:" + json.dumps(out, default=str))
    except Exception:
        print("RESULT: TRACEBACK")
        print(traceback.format_exc())
    finally:
        frappe.set_user("Administrator")

run()
