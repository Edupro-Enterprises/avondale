"""Termly fee billing - generates Fees records for every currently-enrolled
student in a Program, against every Fee Structure configured for that
Program/Academic Year (Levy + Tuition, each posting to its own fund - see
edupro_financials/install.py:create_fees_fund_field). Distinct from the
Pastel migration path (is_opening_balance=1, arbitrary per-student amount,
no term): this bills the *standard* rate, per component, for a specific
term, and is meant to be re-run every term going forward.
"""

import frappe
from erpnext.accounts.utils import reconcile_against_document
from frappe import _
from frappe.utils import flt

from edupro_financials.receipting import backfill_unallocated_fund

RECEIVABLE_ACCOUNT = "Debtors - APS"


@frappe.whitelist()
def get_billing_options():
	return {
		"programs": frappe.get_all("Program", fields=["name"], order_by="name"),
		"academic_years": frappe.get_all("Academic Year", fields=["name"], order_by="name desc"),
		"academic_terms": frappe.get_all(
			"Academic Term", fields=["name", "term_name", "term_start_date"], order_by="term_start_date desc"
		),
	}


@frappe.whitelist()
def preview_term_bill(program, academic_year):
	"""What would billing this program/year actually do - student count,
	which fee structures apply, and how many already have a Fees record for
	each (idempotent runs should show 0 new the second time)."""
	enrollments = frappe.get_all(
		"Program Enrollment", filters={"program": program, "academic_year": academic_year}, fields=["name", "student"]
	)
	fee_structures = frappe.get_all(
		"Fee Structure", filters={"program": program, "academic_year": academic_year}, fields=["name", "fund"]
	)
	for fs in fee_structures:
		components = frappe.get_all(
			"Fee Component", filters={"parent": fs.name}, fields=["fees_category", "amount"]
		)
		fs["components"] = components
		fs["amount"] = sum(flt(c.amount) for c in components)

	return {
		"student_count": len(enrollments),
		"fee_structures": fee_structures,
		"total_per_student": sum(fs["amount"] for fs in fee_structures),
	}


@frappe.whitelist()
def bill_term(program, academic_year, academic_term, due_date):
	"""Create + submit a Fees record per (enrolled student x Fee Structure)
	for this program/year, at the Fee Structure's standard rate. Skips any
	student/fee-structure/term combination that's already billed, so it's
	safe to re-run (e.g. after enrolling more students partway through a
	term)."""
	frappe.only_for("Bursar")

	if not due_date:
		frappe.throw(_("Due date is required."))

	company = frappe.db.get_single_value("Global Defaults", "default_company")

	enrollments = frappe.get_all(
		"Program Enrollment",
		filters={"program": program, "academic_year": academic_year},
		fields=["name", "student", "student_name", "student_batch_name"],
	)
	if not enrollments:
		frappe.throw(_("No students are enrolled in {0} for {1}.").format(program, academic_year))

	fee_structures = frappe.get_all(
		"Fee Structure",
		filters={"program": program, "academic_year": academic_year},
		fields=["name", "fund", "receivable_account", "income_account"],
	)
	if not fee_structures:
		frappe.throw(_("No Fee Structure is configured for {0} in {1}.").format(program, academic_year))

	for fs in fee_structures:
		fs["components"] = frappe.get_all(
			"Fee Component", filters={"parent": fs.name}, fields=["fees_category", "amount"]
		)

	billed = 0
	skipped = 0
	credit_applied = 0

	for pe in enrollments:
		for fs in fee_structures:
			if frappe.db.exists(
				"Fees",
				{"student": pe.student, "fee_structure": fs.name, "academic_term": academic_term, "docstatus": ["!=", 2]},
			):
				skipped += 1
				continue

			fees_doc = frappe.get_doc(
				{
					"doctype": "Fees",
					"student": pe.student,
					"student_name": pe.student_name,
					"company": company,
					"posting_date": frappe.utils.nowdate(),
					"due_date": due_date,
					"program_enrollment": pe.name,
					"program": program,
					"academic_year": academic_year,
					"academic_term": academic_term,
					"fee_structure": fs.name,
					"components": [{"fees_category": c.fees_category, "amount": c.amount} for c in fs.components],
					"receivable_account": fs.receivable_account,
					"income_account": fs.income_account,
					"fund": fs.fund,
					"student_batch": pe.student_batch_name,
				}
			)
			fees_doc.insert(ignore_permissions=True)
			fees_doc.submit()
			billed += 1

			try:
				if _apply_credit_to_new_fees(pe.student, fees_doc):
					credit_applied += 1
			except Exception:
				frappe.log_error(
					title="Credit auto-application failed",
					message=frappe.get_traceback(),
				)

	frappe.db.commit()
	return {
		"students": len(enrollments),
		"fee_structures": len(fee_structures),
		"billed": billed,
		"skipped_already_billed": skipped,
		"credit_applied_to": credit_applied,
	}


def _apply_credit_to_new_fees(student, fees_doc):
	"""A student who has already paid in advance (an overpayment sitting as
	unallocated_amount on a past Payment Entry - see receipting.py's
	Prepaid Fee Management) shouldn't have to be manually reconciled every
	time a new term gets billed. As soon as this Fees record is submitted,
	pull from that student's oldest available credit first (fairest order)
	until either the credit or the new bill runs out.

	Goes through ERPNext's own reconcile_against_document (the same engine
	the Payment Reconciliation tool uses) rather than editing the
	Payment Entry's references table directly, since that helper already
	handles rebuilding GL entries, the payment ledger, and outstanding
	amounts correctly for a submitted document."""
	credit_entries = frappe.get_all(
		"Payment Entry",
		filters={
			"party_type": "Student",
			"party": student,
			"payment_type": "Receive",
			"docstatus": 1,
			"unallocated_amount": [">", 0],
		},
		fields=["name", "unallocated_amount"],
		order_by="posting_date asc, creation asc",
	)
	if not credit_entries:
		return False

	applied_any = False
	for credit in credit_entries:
		fees_doc.reload()
		outstanding = flt(fees_doc.outstanding_amount)
		if outstanding <= 0.005:
			break

		unallocated = flt(
			frappe.db.get_value("Payment Entry", credit.name, "unallocated_amount")
		)
		if unallocated <= 0.005:
			continue

		allocate = min(unallocated, outstanding)

		args = frappe._dict(
			{
				"voucher_type": "Payment Entry",
				"voucher_no": credit.name,
				"voucher_detail_no": None,
				"against_voucher_type": "Fees",
				"against_voucher": fees_doc.name,
				"account": RECEIVABLE_ACCOUNT,
				"party_type": "Student",
				"party": student,
				"is_advance": "Yes",
				"dr_or_cr": "credit_in_account_currency",
				"unreconciled_amount": unallocated,
				"unadjusted_amount": unallocated,
				"allocated_amount": allocate,
				"difference_amount": 0,
				"difference_account": None,
				"exchange_rate": 1,
				"grand_total": fees_doc.grand_total,
				"outstanding_amount": outstanding,
			}
		)
		reconcile_against_document([args])

		remaining_unallocated = flt(
			frappe.db.get_value("Payment Entry", credit.name, "unallocated_amount")
		)
		if remaining_unallocated <= 0.005:
			backfill_unallocated_fund(credit.name, fees_doc.fund)
		applied_any = True

	frappe.db.commit()
	return applied_any
