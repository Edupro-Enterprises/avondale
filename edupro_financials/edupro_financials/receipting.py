"""Student Fee Ledger & Counter Receipting (spec section 1).

Payments are recorded as standard ERPNext Payment Entries against the
Student party (Student is already a registered Party Type with a
Receivable account_type) - this is the correct, audited mechanism rather
than a bespoke one: it reuses ERPNext's own outstanding-amount tracking,
multi-currency exchange-rate handling, and advance/credit reconciliation,
and every Payment Entry gets a sequential receipt number the moment it's
submitted (see receipts.py:assign_receipt_number_to_payment).

A single payment is allocated across a student's outstanding Fees
records oldest-due-first. Since each Fees record already carries its own
fund (Levy -> SDC/SDA, Tuition -> Tuition/Government - see
install.py:create_fees_fund_field), paying off several Fees lines in one
receipt naturally splits the money across the correct statutory funds
without any extra bookkeeping ("Automatic Fund Allocation"). Anything left
over after every outstanding line is covered becomes an unallocated
advance on the Payment Entry - available credit against whatever gets
billed next (see billing.py's credit auto-application).
"""

import frappe
from frappe import _
from frappe.utils import flt, nowdate

from edupro_financials.exchange_rate import get_rate_for_date

RECEIVABLE_ACCOUNT = "Debtors - APS"


@frappe.whitelist()
def search_student_accounts(query=None, program=None, student_batch_name=None, limit=50):
	conditions = ["1=1"]
	values = {"limit": int(limit)}

	if query:
		conditions.append(
			"(s.student_name like %(q)s or s.name like %(q)s or s.pastel_account_code like %(q)s)"
		)
		values["q"] = f"%{query}%"
	if program:
		conditions.append("pe.program = %(program)s")
		values["program"] = program
	if student_batch_name:
		conditions.append("pe.student_batch_name = %(student_batch_name)s")
		values["student_batch_name"] = student_batch_name

	rows = frappe.db.sql(
		f"""
		select distinct s.name as student, s.student_name, s.pastel_account_code,
			pe.program, pe.student_batch_name
		from `tabStudent` s
		inner join `tabProgram Enrollment` pe on pe.student = s.name
		where {' and '.join(conditions)}
		order by s.student_name asc
		limit %(limit)s
		""",
		values,
		as_dict=True,
	)

	for row in rows:
		row["outstanding"] = flt(
			frappe.db.sql(
				"select coalesce(sum(outstanding_amount), 0) from `tabFees` "
				"where student = %(s)s and docstatus = 1 and outstanding_amount > 0",
				{"s": row.student},
			)[0][0]
		)
	return rows


@frappe.whitelist()
def get_student_account(student):
	student_doc = frappe.db.get_value(
		"Student", student, ["student_name", "pastel_account_code"], as_dict=True
	)
	if not student_doc:
		frappe.throw(_("Student not found."))

	enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": student},
		fields=["program", "student_batch_name", "academic_year"],
		order_by="academic_year desc",
		limit_page_length=1,
	)

	outstanding_fees = frappe.get_all(
		"Fees",
		filters={"student": student, "docstatus": 1, "outstanding_amount": [">", 0]},
		fields=[
			"name", "academic_term", "academic_year", "fee_structure", "fund",
			"due_date", "grand_total", "outstanding_amount", "is_opening_balance",
		],
		order_by="due_date asc, creation asc",
	)

	credit_balance = get_credit_balance(student)

	return {
		"student": student,
		"student_name": student_doc.student_name,
		"pastel_account_code": student_doc.pastel_account_code,
		"program": enrollment[0].program if enrollment else None,
		"student_batch_name": enrollment[0].student_batch_name if enrollment else None,
		"outstanding_fees": outstanding_fees,
		"total_outstanding": sum(flt(f.outstanding_amount) for f in outstanding_fees),
		"credit_balance": credit_balance,
	}


def get_credit_balance(student):
	"""Sum of unallocated amounts sitting on this student's submitted
	Receive-type Payment Entries - money already collected but not yet
	applied against any specific Fees line (an overpayment, or a deliberate
	advance payment for a future term)."""
	total = frappe.db.sql(
		"""
		select coalesce(sum(unallocated_amount), 0)
		from `tabPayment Entry`
		where party_type = 'Student' and party = %(student)s
		  and payment_type = 'Receive' and docstatus = 1
		""",
		{"student": student},
	)[0][0]
	return flt(total)


@frappe.whitelist()
def get_receipting_form_options():
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	# Only offer tenders actually wired up for receipting (spec: USD Cash,
	# ZiG Cash, EcoCash, ZIPIT, POS Swipe, Direct Bank Transfers - see
	# install.py:create_receipting_accounts_and_modes) - other Mode of
	# Payment records (Cheque, Credit Card, Bank Draft) are standard
	# ERPNext defaults with no account configured for this company, so
	# receipt_payment() would just reject them.
	modes = frappe.get_all(
		"Mode of Payment Account",
		filters={"company": company},
		fields=["parent as name"],
		order_by="parent",
	)
	return {
		"modes_of_payment": modes,
		"today_rate": get_rate_for_date(nowdate()),
		"programs": frappe.get_all("Program", fields=["name"], order_by="name"),
		"student_batches": frappe.get_all("Student Batch Name", fields=["name"], order_by="name"),
	}


def backfill_reference_fund(voucher_no, reference_doctype, reference_name, fund):
	"""Tag the Debtors-side GL Entry row a Payment Entry (or a later
	reconciliation against one - see billing.py's credit auto-application)
	posted for one specific reference, with that reference's fund.

	ERPNext's Payment Entry GL generation has no concept of the Fund
	accounting dimension, so every GL Entry it posts comes out with
	fund=null - even though the row is already tied back to a specific
	Fees record (and therefore a specific fund) via
	against_voucher/against_voucher_type. Patch that in directly: it's a
	dimension backfill on a row already posted and balanced, not a change
	to any amount, so it can't unbalance the ledger.
	"""
	if not fund:
		return
	frappe.db.sql(
		"""
		update `tabGL Entry`
		set fund = %(fund)s
		where voucher_no = %(voucher_no)s
		  and against_voucher_type = %(ref_doctype)s
		  and against_voucher = %(ref_name)s
		  and is_cancelled = 0
		""",
		{
			"fund": fund,
			"voucher_no": voucher_no,
			"ref_doctype": reference_doctype,
			"ref_name": reference_name,
		},
	)


def backfill_unallocated_fund(voucher_no, fund):
	"""Tag a Payment Entry's advance/unallocated GL row (the one posted for
	whatever was left over as credit at receipting time - see
	receipt_payment) with a fund, once billing.py's credit
	auto-application has fully consumed that credit against one
	single-fund Fees record in one reconciliation call.

	reconcile_against_document (ERPNext's own Payment Reconciliation
	engine, used to apply this credit) deliberately does not rewrite the
	original GL Entry row when a credit gets reconciled against an
	invoice later - only the Payment Entry Reference table and the
	Payment Ledger Entry (which drives outstanding_amount) change. GL
	Entry stays an immutable record of the cash movement itself. So the
	only way to get the fund dimension onto that row at all is to tag it
	here, and only when we can be sure of a single fund: if the credit
	gets consumed by more than one fund across separate calls, this row
	is left untagged - the same documented limitation as the paid_to row
	in _backfill_gl_fund, for the same reason (one GL row can't carry two
	funds without actually splitting it)."""
	if not fund:
		return
	frappe.db.sql(
		"""
		update `tabGL Entry`
		set fund = %(fund)s
		where voucher_no = %(voucher_no)s
		  and account = %(account)s
		  and (against_voucher is null or against_voucher = '')
		  and is_cancelled = 0
		  and fund is null
		""",
		{"fund": fund, "voucher_no": voucher_no, "account": RECEIVABLE_ACCOUNT},
	)


def _backfill_gl_fund(pe, references):
	"""Backfill every Debtors-side reference row from a fresh receipt (see
	backfill_reference_fund), plus the paid_to (Cash/Bank) row where
	possible.

	The paid_to row is a single lump sum with no natural per-fund split
	when one payment covers Fees from more than one fund - splitting it
	would mean rewriting the ledger row itself, not just tagging it, so
	that's left as a documented limitation. When every referenced Fees
	shares the same fund (the common case) there's no ambiguity, so the
	cash/bank row is tagged too.
	"""
	funds = set()
	for ref in references:
		fund = frappe.db.get_value(ref["reference_doctype"], ref["reference_name"], "fund")
		if not fund:
			continue
		funds.add(fund)
		backfill_reference_fund(pe.name, ref["reference_doctype"], ref["reference_name"], fund)

	if len(funds) == 1:
		frappe.db.sql(
			"""
			update `tabGL Entry`
			set fund = %(fund)s
			where voucher_no = %(voucher_no)s
			  and (against_voucher is null or against_voucher = '')
			  and is_cancelled = 0
			""",
			{"fund": funds.pop(), "voucher_no": pe.name},
		)


@frappe.whitelist()
def receipt_payment(student, tender_amount, mode_of_payment, reference_no=None, terminal="HAR"):
	"""Receive `tender_amount` (in whatever currency the chosen Mode of
	Payment's account is denominated in) from a student, auto-allocated
	across their outstanding Fees oldest-first. Any excess becomes an
	unallocated advance."""
	frappe.only_for("Bursar")

	tender_amount = flt(tender_amount)
	if tender_amount <= 0:
		frappe.throw(_("Amount must be greater than zero."))

	company = frappe.db.get_single_value("Global Defaults", "default_company")

	mode_account = frappe.db.get_value(
		"Mode of Payment Account", {"parent": mode_of_payment, "company": company}, "default_account"
	)
	if not mode_account:
		frappe.throw(_("Mode of Payment {0} has no default account configured for {1}.").format(mode_of_payment, company))
	paid_to_currency = frappe.db.get_value("Account", mode_account, "account_currency")

	if paid_to_currency == company and paid_to_currency != "ZiG":
		pass  # normal case handled below regardless

	target_exchange_rate = 1.0
	if paid_to_currency != "USD":
		rate_info = get_rate_for_date(nowdate())
		if not rate_info["is_set"]:
			frappe.throw(
				_("No exchange rate has been set for today. Ask a Bursar to set today's rate before receipting {0}.").format(
					paid_to_currency
				)
			)
		target_exchange_rate = rate_info["zig_to_usd"] if paid_to_currency == "ZiG" else 1 / rate_info["zig_to_usd"]

	received_amount = tender_amount
	paid_amount = flt(received_amount * target_exchange_rate, 2)  # USD-equivalent applied against the (USD) debt

	outstanding_fees = frappe.get_all(
		"Fees",
		filters={"student": student, "docstatus": 1, "outstanding_amount": [">", 0]},
		fields=["name", "outstanding_amount", "grand_total"],
		order_by="due_date asc, creation asc",
	)

	references = []
	remaining = paid_amount
	for fee in outstanding_fees:
		if remaining <= 0.005:
			break
		allocate = min(flt(fee.outstanding_amount), remaining)
		references.append(
			{
				"reference_doctype": "Fees",
				"reference_name": fee.name,
				"total_amount": fee.grand_total,
				"outstanding_amount": fee.outstanding_amount,
				"allocated_amount": allocate,
			}
		)
		remaining -= allocate

	pe = frappe.get_doc(
		{
			"doctype": "Payment Entry",
			"payment_type": "Receive",
			"party_type": "Student",
			"party": student,
			"company": company,
			"posting_date": nowdate(),
			"mode_of_payment": mode_of_payment,
			"paid_from": RECEIVABLE_ACCOUNT,
			"paid_from_account_currency": "USD",
			"paid_to": mode_account,
			"paid_to_account_currency": paid_to_currency,
			"paid_amount": paid_amount,
			"source_exchange_rate": 1,
			"base_paid_amount": paid_amount,
			"received_amount": received_amount,
			"target_exchange_rate": target_exchange_rate,
			"reference_no": reference_no or terminal,
			"reference_date": nowdate(),
			"terminal": terminal,
			"references": references,
		}
	)
	pe.insert(ignore_permissions=True)
	pe.submit()
	_backfill_gl_fund(pe, references)
	frappe.db.commit()

	return {
		"payment_entry": pe.name,
		"receipt_no": frappe.db.get_value("Payment Entry", pe.name, "receipt_no"),
		"paid_amount_usd": paid_amount,
		"tendered": tender_amount,
		"tendered_currency": paid_to_currency,
		"allocated_to_fees": len(references),
		"unallocated_credit": flt(pe.unallocated_amount),
	}
