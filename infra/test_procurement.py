import frappe, json, traceback

def run():
    frappe.set_user("bursar@avondale.local")
    out = {}
    try:
        from edupro_financials.procurement import create_supplier, create_requisition, get_vote_book_balance, submit_requisition

        supplier = create_supplier("Test Stationery Supplier")
        out["supplier"] = supplier

        # 1. REJECTION PATH: no Vote Book Allocation exists yet for this account/fund/year
        try:
            create_requisition(
                supplier=supplier,
                fiscal_year="2026",
                schedule_date="2026-09-01",
                items=[{
                    "description": "Test stationery - no budget",
                    "expense_account": "Print and Stationery - APS",
                    "funding_category": "SDC / SDA",
                    "rate": 50,
                }],
            )
            out["rejection_path"] = "UNEXPECTED SUCCESS - should have been rejected"
        except Exception as e:
            out["rejection_path"] = f"correctly rejected: {str(e)[:200]}"

        frappe.db.rollback()
        print("RESULT_JSON:" + json.dumps(out, default=str))
    except Exception:
        print("RESULT: TRACEBACK")
        print(traceback.format_exc())
    finally:
        frappe.set_user("Administrator")

run()
