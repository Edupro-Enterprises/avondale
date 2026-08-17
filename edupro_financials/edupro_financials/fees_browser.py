"""Searchable Fees browser backing the portal's "Student Fees" page -
lets Bursar/Headmaster/SDC/Deputy Head look up a student's bills by class
(stream), academic year, term, name, or student ID, then either print an
individual line via /printview or pull up a combined per-student statement.
"""

import frappe
from frappe.utils import flt, fmt_money


@frappe.whitelist()
def search_fees(
	student_batch_name=None,
	academic_year=None,
	academic_term=None,
	student_name=None,
	student_id=None,
	limit=300,
):
	conditions = ["fees.docstatus != 2"]
	values = {}

	if student_batch_name:
		conditions.append("pe.student_batch_name = %(student_batch_name)s")
		values["student_batch_name"] = student_batch_name
	if academic_year:
		conditions.append("fees.academic_year = %(academic_year)s")
		values["academic_year"] = academic_year
	if academic_term:
		conditions.append("fees.academic_term = %(academic_term)s")
		values["academic_term"] = academic_term
	if student_name:
		conditions.append("fees.student_name like %(student_name)s")
		values["student_name"] = f"%{student_name}%"
	if student_id:
		conditions.append("fees.student like %(student_id)s")
		values["student_id"] = f"%{student_id}%"

	values["limit"] = int(limit)

	rows = frappe.db.sql(
		f"""
		select
			fees.name, fees.student, fees.student_name, fees.academic_year, fees.academic_term,
			fees.fee_structure, fees.fund, fees.grand_total, fees.outstanding_amount,
			fees.receipt_no, fees.docstatus, fees.due_date, fees.posting_date,
			pe.student_batch_name
		from `tabFees` fees
		left join `tabProgram Enrollment` pe on pe.name = fees.program_enrollment
		where {" and ".join(conditions)}
		order by fees.posting_date desc, fees.student_name asc
		limit %(limit)s
		""",
		values,
		as_dict=True,
	)
	return rows


@frappe.whitelist()
def get_filter_options():
	return {
		"batches": frappe.get_all("Student Batch Name", fields=["name"], order_by="name"),
		"academic_years": frappe.get_all("Academic Year", fields=["name"], order_by="name desc"),
		"academic_terms": frappe.get_all(
			"Academic Term", fields=["name", "term_name"], order_by="term_start_date desc"
		),
	}


@frappe.whitelist()
def get_student_statement(student, academic_term=None, academic_year=None):
	"""Every fee line for one student, combined into a single statement -
	the per-document receipt (before_print combining in receipts.py) only
	ever pairs up same-term siblings; this covers the whole account,
	optionally scoped to one term/year, for a proper "what does this
	family owe in total" view."""
	filters = {"student": student, "docstatus": ["!=", 2]}
	if academic_term:
		filters["academic_term"] = academic_term
	if academic_year:
		filters["academic_year"] = academic_year

	fees_records = frappe.get_all(
		"Fees",
		filters=filters,
		fields=[
			"name", "academic_year", "academic_term", "fee_structure", "fund",
			"grand_total", "outstanding_amount", "receipt_no", "docstatus",
			"due_date", "posting_date", "is_opening_balance", "currency",
		],
		order_by="posting_date asc",
	)

	lines = []
	for fees in fees_records:
		components = frappe.get_all(
			"Fee Component",
			filters={"parent": fees.name, "parenttype": "Fees"},
			fields=["fees_category", "amount"],
		)
		for c in components:
			lines.append(
				{
					"fees_name": fees.name,
					"academic_year": fees.academic_year,
					"academic_term": fees.academic_term,
					"fees_category": c.fees_category,
					"fund": fees.fund,
					"amount": flt(c.amount),
					"outstanding_amount": flt(fees.outstanding_amount),
					"receipt_no": fees.receipt_no,
					"due_date": fees.due_date,
					"posting_date": fees.posting_date,
					"is_opening_balance": fees.is_opening_balance,
					"status": "Paid" if flt(fees.outstanding_amount) <= 0.005 else "Balance Due",
				}
			)

	student_doc = frappe.db.get_value(
		"Student", student, ["student_name", "pastel_account_code"], as_dict=True
	) or {}

	batch = frappe.db.sql(
		"""
		select pe.student_batch_name
		from `tabProgram Enrollment` pe
		where pe.student = %(student)s
		order by pe.academic_year desc
		limit 1
		""",
		{"student": student},
		as_dict=True,
	)

	grand_total = sum(flt(f.grand_total) for f in fees_records)
	outstanding_total = sum(flt(f.outstanding_amount) for f in fees_records)

	return {
		"student": student,
		"student_name": student_doc.get("student_name"),
		"student_batch_name": batch[0].student_batch_name if batch else None,
		"lines": lines,
		"grand_total": grand_total,
		"outstanding_total": outstanding_total,
		"grand_total_formatted": fmt_money(grand_total, currency="USD"),
		"outstanding_total_formatted": fmt_money(outstanding_total, currency="USD"),
	}
