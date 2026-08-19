import frappe, json

def run():
    out = {"adjusted": 0, "errors": []}

    opening_fees = frappe.get_all(
        "Fees",
        filters={"fee_structure": "EDU-FST-2026-00017", "is_opening_balance": 1, "docstatus": 1},
        fields=["name", "student", "student_name", "program_enrollment", "program", "academic_year",
                "receivable_account", "income_account", "fund", "student_batch", "grand_total",
                "posting_date", "due_date", "company"],
    )
    out["total_records"] = len(opening_fees)

    for rec in opening_fees:
        try:
            new_amount = rec.grand_total - 300

            old_doc = frappe.get_doc("Fees", rec.name)
            old_doc.flags.ignore_permissions = True
            old_doc.cancel()

            new_doc = frappe.get_doc({
                "doctype": "Fees",
                "student": rec.student,
                "student_name": rec.student_name,
                "company": rec.company,
                "posting_date": rec.posting_date,
                "due_date": rec.due_date,
                "program_enrollment": rec.program_enrollment,
                "program": rec.program,
                "academic_year": rec.academic_year,
                "fee_structure": "EDU-FST-2026-00017",
                "components": [{"fees_category": "Levy", "amount": new_amount}],
                "grand_total": new_amount,
                "receivable_account": rec.receivable_account,
                "income_account": rec.income_account,
                "fund": rec.fund,
                "student_batch": rec.student_batch,
                "is_opening_balance": 1,
            })
            new_doc.insert(ignore_permissions=True)
            new_doc.submit()
            out["adjusted"] += 1
        except Exception as e:
            out["errors"].append({"student": rec.student, "name": rec.name, "error": str(e)[:200]})

    frappe.db.commit()
    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
