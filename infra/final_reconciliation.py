import frappe, json

def run():
    out = {}

    abd24 = frappe.db.get_value("Student", {"pastel_account_code": "ABD24"}, "name")
    abd24_fees = frappe.get_all(
        "Fees",
        filters={"student": abd24, "docstatus": 1},
        fields=["name", "fee_structure", "academic_term", "grand_total", "is_opening_balance"],
        order_by="creation",
    )
    out["abd24_fees"] = abd24_fees
    out["abd24_total_owed"] = sum(f.grand_total for f in abd24_fees)

    out["active_fees_count"] = frappe.db.count("Fees", {"docstatus": 1})
    out["cancelled_fees_count"] = frappe.db.count("Fees", {"docstatus": 2})

    # Reconciliation: corrected opening balance + Term1 Levy + Term2 Levy should equal
    # original imported total ($45,497.91)
    opening_sum = frappe.db.sql("""
        select sum(grand_total) from `tabFees`
        where fee_structure='EDU-FST-2026-00017' and is_opening_balance=1 and docstatus=1
    """)[0][0]
    term1_levy_sum = frappe.db.sql("""
        select sum(grand_total) from `tabFees`
        where fee_structure='EDU-FST-2026-00017' and academic_term='2026 (Term 1 2026)' and docstatus=1
    """)[0][0]
    term2_levy_sum = frappe.db.sql("""
        select sum(grand_total) from `tabFees`
        where fee_structure='EDU-FST-2026-00017' and academic_term='2026 (Term 2 2026)' and docstatus=1
    """)[0][0]
    out["opening_sum"] = opening_sum
    out["term1_levy_sum"] = term1_levy_sum
    out["term2_levy_sum"] = term2_levy_sum
    out["reconciled_total"] = opening_sum + term1_levy_sum + term2_levy_sum
    out["original_total"] = 45497.91

    tuition_total = frappe.db.sql("""
        select sum(grand_total) from `tabFees`
        where fee_structure='EDU-FST-2026-00018' and docstatus=1
    """)[0][0]
    out["tuition_total_all_terms"] = tuition_total
    out["expected_tuition_total"] = 158 * 60

    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
