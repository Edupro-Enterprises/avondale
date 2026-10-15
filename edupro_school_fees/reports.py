"""Phase 7: the three core statutory financial statements (Statement of Receipts
and Payments, Statement of Comprehensive Income, Statement of Financial Position),
computed on demand from the existing Journal Entry ledger -- nothing here is
stored or cached, so there is exactly one source of truth for every figure,
matching Bank Reconciliation's _compute_cashbook_balance() precedent (Phase 6b).

Vote-Book Variance Report, MoPSE ED46 Termly Return, BEAM Claims
reconciliation, and the Fixed Assets/PRAZ Disposal Register report each live
in their own module/doctype instead (statutory_reports_extra.py,
mopse_ed46_return.py, beam_claim.py) -- substantial enough to warrant it.
"""

import frappe
from frappe.utils import flt, nowdate

from edupro_school_fees.utils import BASE_CURRENCY, convert_amount, get_exchange_rate

_ALLOWED_ROLES = {
	"Bursar", "School Head", "SDC Chairperson/Treasurer",
	"District Education Auditor/Inspector", "System Manager",
}


def _require_internal_role():
	# Reports are school-wide financial data -- explicitly out of bounds for
	# Parent/Guardian and Student (spec BR-PRT-02) and for any role without a
	# real reporting duty. frappe.only_for() no-ops for Administrator/under
	# frappe.flags.in_test (see ADR history), so this is a plain manual check.
	if not _ALLOWED_ROLES & set(frappe.get_roles(frappe.session.user)):
		frappe.throw("Not permitted to view financial reports.", frappe.PermissionError)


def _log_report_generated(report_name, extra=""):
	"""DEF-025: BR-RPT-04 requires report generation to be audit-logged -- this
	used to be true for exactly one endpoint (get_audit_trail_export, which
	self-logs since exporting the audit trail is its own data-egress event).
	Every other report silently generated with no trace. Called after
	_require_internal_role() so an unauthorized attempt is never logged as if
	it were a real view."""
	from frappe.utils import now_datetime
	frappe.get_doc({
		"doctype": "Audit Log",
		"user": frappe.session.user,
		"role": ", ".join(frappe.get_roles(frappe.session.user)),
		"action": f"Report generated: {report_name}{extra}",
		"timestamp": now_datetime(),
	}).insert(ignore_permissions=True)


def _account_totals(where_clause, params):
	"""Dr/Cr totals per Account, normalized into BASE_CURRENCY via each row's own
	snapshotted exchange_rate (Phase 3), for submitted Journal Entries matching
	where_clause."""
	return frappe.db.sql(
		f"""
		SELECT jea.account, a.account_type, a.fund,
		       COALESCE(SUM(jea.debit * jea.exchange_rate), 0) AS debit,
		       COALESCE(SUM(jea.credit * jea.exchange_rate), 0) AS credit
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		INNER JOIN `tabAccount` a ON a.name = jea.account
		WHERE je.docstatus = 1 AND {where_clause}
		GROUP BY jea.account, a.account_type, a.fund
		""",
		params,
		as_dict=True,
	)


def _usd_equivalent(zig_amount, as_of_date):
	"""Best-effort secondary figure (FR-FIN-02) using the rate in force as of the
	report's own date, not today's -- a report for March shouldn't shift every
	time it's re-viewed just because the rate moved since. Returns None rather
	than throwing if no Exchange Rate has ever been recorded for the pair; the
	frontend hides the USD line when this comes back empty."""
	try:
		rate = get_exchange_rate(BASE_CURRENCY, "USD", as_of_date)
		return flt(convert_amount(zig_amount, BASE_CURRENCY, "USD", rate), 2)
	except Exception:
		return None


@frappe.whitelist()
def get_receipts_and_payments(from_date, to_date):
	"""Cash-basis: any submitted Journal Entry that touches a cash/bank account
	(Payment Method.account -- the app's own definition of "a cash or bank
	account"), grouped by what produced it. A Receipt's JE debits cash-in;
	Cashbook Payment/Petty Cash Replenishment's JE credits cash-out -- the net
	debit-credit per reference_doctype tells receipts from payments without
	needing an explicit "is_cash" flag on Account."""
	_require_internal_role()
	_log_report_generated("Statement of Receipts and Payments", f" ({from_date} to {to_date})")

	cash_accounts = list({row for row in frappe.get_all("Payment Method", pluck="account") if row})
	empty = {
		"from_date": from_date, "to_date": to_date,
		"receipt_lines": [], "payment_lines": [],
		"total_receipts": 0, "total_payments": 0, "net_movement": 0,
		"total_receipts_usd": None, "total_payments_usd": None, "net_movement_usd": None,
	}
	if not cash_accounts:
		return empty

	placeholders = ", ".join(["%s"] * len(cash_accounts))
	rows = frappe.db.sql(
		f"""
		SELECT je.reference_doctype,
		       COALESCE(SUM(jea.debit * jea.exchange_rate), 0) AS debit,
		       COALESCE(SUM(jea.credit * jea.exchange_rate), 0) AS credit
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		WHERE je.docstatus = 1 AND je.posting_date BETWEEN %s AND %s
		  AND jea.account IN ({placeholders})
		GROUP BY je.reference_doctype
		""",
		(from_date, to_date, *cash_accounts),
		as_dict=True,
	)

	receipt_lines, payment_lines = [], []
	total_receipts = total_payments = 0.0
	for row in rows:
		net = flt(row.debit - row.credit, 2)
		label = row.reference_doctype or "Other"
		if net > 0:
			receipt_lines.append({"source": label, "amount": net})
			total_receipts += net
		elif net < 0:
			payment_lines.append({"source": label, "amount": -net})
			total_payments += -net

	total_receipts = flt(total_receipts, 2)
	total_payments = flt(total_payments, 2)
	net_movement = flt(total_receipts - total_payments, 2)

	return {
		"from_date": from_date, "to_date": to_date,
		"receipt_lines": sorted(receipt_lines, key=lambda r: -r["amount"]),
		"payment_lines": sorted(payment_lines, key=lambda r: -r["amount"]),
		"total_receipts": total_receipts,
		"total_payments": total_payments,
		"net_movement": net_movement,
		"total_receipts_usd": _usd_equivalent(total_receipts, to_date),
		"total_payments_usd": _usd_equivalent(total_payments, to_date),
		"net_movement_usd": _usd_equivalent(net_movement, to_date),
	}


@frappe.whitelist()
def get_cash_book(account=None, from_date=None, to_date=None):
	"""Chronological running-balance ledger for one Cash/Bank account (any
	Payment Method.account) -- the Payments > Cash Book page. Opening balance
	is every submitted JE line for this account strictly before from_date;
	each line's own exchange_rate-normalized amount is used, matching every
	other report in this module."""
	_require_internal_role()
	cash_accounts = sorted({row for row in frappe.get_all("Payment Method", pluck="account") if row})
	if not cash_accounts:
		return {"accounts": [], "account": None, "from_date": from_date, "to_date": to_date,
				"opening_balance": 0, "lines": [], "closing_balance": 0}

	account = account if account in cash_accounts else cash_accounts[0]
	from_date = from_date or "1900-01-01"
	to_date = to_date or nowdate()

	opening_row = frappe.db.sql(
		"""
		SELECT COALESCE(SUM(jea.debit * jea.exchange_rate), 0) - COALESCE(SUM(jea.credit * jea.exchange_rate), 0)
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		WHERE je.docstatus = 1 AND jea.account = %s AND je.posting_date < %s
		""",
		(account, from_date),
	)
	opening = flt(opening_row[0][0] if opening_row else 0, 2)

	rows = frappe.db.sql(
		"""
		SELECT je.name AS voucher_no, je.posting_date, je.reference_doctype, je.reference_name,
		       je.remarks, jea.debit * jea.exchange_rate AS debit, jea.credit * jea.exchange_rate AS credit
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		WHERE je.docstatus = 1 AND jea.account = %s AND je.posting_date BETWEEN %s AND %s
		ORDER BY je.posting_date, je.name
		""",
		(account, from_date, to_date),
		as_dict=True,
	)

	balance = opening
	lines = []
	for row in rows:
		balance = flt(balance + flt(row.debit) - flt(row.credit), 2)
		lines.append({
			"voucher_no": row.voucher_no,
			"posting_date": str(row.posting_date),
			"reference_doctype": row.reference_doctype,
			"reference_name": row.reference_name,
			"description": row.remarks,
			"debit": flt(row.debit, 2),
			"credit": flt(row.credit, 2),
			"balance": balance,
		})

	return {
		"accounts": cash_accounts,
		"account": account,
		"from_date": from_date,
		"to_date": to_date,
		"opening_balance": opening,
		"lines": lines,
		"closing_balance": balance,
	}


@frappe.whitelist()
def get_daily_cash_collection(collection_date=None):
	"""Report 1 (print_reports): every submitted Receipt posted on one date,
	itemised with cashier -- unlike get_receipts_and_payments (which only
	returns totals by source), this is the per-transaction listing a bursar
	reconciles a shift/day against."""
	_require_internal_role()
	collection_date = collection_date or nowdate()
	_log_report_generated("Daily Cash Collection Report", f" ({collection_date})")

	rows = frappe.db.sql(
		"""
		SELECT r.name AS receipt_no, r.posting_date, r.creation, s.first_name, s.last_name,
		       r.student, pm.method_name AS payment_method, r.currency, r.amount, r.received_by
		FROM `tabReceipt` r
		INNER JOIN `tabStudent` s ON s.name = r.student
		LEFT JOIN `tabPayment Method` pm ON pm.name = r.payment_method
		WHERE r.docstatus = 1 AND r.posting_date = %s AND r.status = 'Submitted'
		ORDER BY r.creation
		""",
		collection_date,
		as_dict=True,
	)

	by_method = {}
	total = 0.0
	for row in rows:
		usd = flt(row.amount) if row.currency == "USD" else flt(_usd_equivalent(row.amount, collection_date) or 0)
		row["amount_usd"] = usd
		key = row.payment_method or "Unspecified"
		by_method[key] = flt(by_method.get(key, 0) + usd, 2)
		total += usd

	return {
		"collection_date": collection_date,
		"lines": rows,
		"by_payment_method": by_method,
		"grand_total_usd": flt(total, 2),
	}


@frappe.whitelist()
def get_payment_summary(from_date, to_date):
	"""Report 4 (print_reports): submitted Receipts in the period, grouped by
	Payment Method (configurable -- never hard-coded) rather than by
	reference_doctype the way get_receipts_and_payments groups them."""
	_require_internal_role()
	_log_report_generated("Payment Summary Report", f" ({from_date} to {to_date})")

	rows = frappe.db.sql(
		"""
		SELECT pm.method_name AS payment_method, r.currency,
		       COUNT(r.name) AS transaction_count, COALESCE(SUM(r.amount), 0) AS total_amount
		FROM `tabReceipt` r
		LEFT JOIN `tabPayment Method` pm ON pm.name = r.payment_method
		WHERE r.docstatus = 1 AND r.status = 'Submitted' AND r.posting_date BETWEEN %s AND %s
		GROUP BY pm.method_name, r.currency
		ORDER BY pm.method_name
		""",
		(from_date, to_date),
		as_dict=True,
	)
	for row in rows:
		row.payment_method = row.payment_method or "Unspecified"

	total_transactions = sum(r.transaction_count for r in rows)
	total_usd = sum(
		flt(r.total_amount) if r.currency == "USD" else flt(_usd_equivalent(r.total_amount, to_date) or 0)
		for r in rows
	)
	return {
		"from_date": from_date, "to_date": to_date,
		"lines": rows,
		"total_transactions": total_transactions,
		"total_collected_usd": flt(total_usd, 2),
	}


@frappe.whitelist()
def get_outstanding_fees_report(academic_year=None, grade=None, threshold=None):
	"""Report 3 (print_reports): every student with a still-open Invoice --
	broader than debtor_case.get_ageing_summary(), which only covers cases
	that have already escalated into a Debtor Case record. Reuses the exact
	same "open invoice" definition as notifications._outstanding_balance()
	(docstatus=1, outstanding_amount > 0), just aggregated per student
	instead of summed for one."""
	_require_internal_role()
	_log_report_generated("Outstanding Fees Report", f" (year={academic_year}, grade={grade})")

	conditions = ["i.docstatus = 1", "i.outstanding_amount > 0"]
	params = []
	if academic_year:
		conditions.append("i.academic_year = %s")
		params.append(academic_year)
	if grade:
		conditions.append("s.grade = %s")
		params.append(grade)

	rows = frappe.db.sql(
		f"""
		SELECT s.name AS student, s.first_name, s.last_name, s.grade, s.guardian,
		       COUNT(i.name) AS invoice_count, COALESCE(SUM(i.total_amount), 0) AS total_invoiced,
		       COALESCE(SUM(i.total_amount - i.outstanding_amount), 0) AS total_paid,
		       COALESCE(SUM(i.outstanding_amount), 0) AS outstanding_amount,
		       (SELECT MAX(r.posting_date) FROM `tabReceipt` r WHERE r.student = s.name AND r.docstatus = 1) AS last_payment_date
		FROM `tabInvoice` i
		INNER JOIN `tabStudent` s ON s.name = i.student
		WHERE {" AND ".join(conditions)}
		GROUP BY s.name, s.first_name, s.last_name, s.grade, s.guardian
		HAVING outstanding_amount > %s
		ORDER BY outstanding_amount DESC
		""",
		(*params, flt(threshold or 0)),
		as_dict=True,
	)

	guardian_names = {
		g.name: g.full_name for g in frappe.get_all(
			"Parent Guardian", filters={"name": ["in", [r.guardian for r in rows if r.guardian]] or [""]},
			fields=["name", "full_name"],
		)
	}
	by_grade = {}
	total_outstanding = 0.0
	for row in rows:
		row["guardian_name"] = guardian_names.get(row.guardian)
		grade_key = row.grade or "Ungraded"
		by_grade[grade_key] = flt(by_grade.get(grade_key, 0) + row.outstanding_amount, 2)
		total_outstanding += row.outstanding_amount

	return {
		"academic_year": academic_year, "grade": grade,
		"rows": rows,
		"student_count": len(rows),
		"total_outstanding": flt(total_outstanding, 2),
		"by_grade": by_grade,
	}


@frappe.whitelist()
def get_comprehensive_income(from_date, to_date):
	"""Accrual basis, IPSAS 1 shape: Income (Cr-heavy accounts) less Expense
	(Dr-heavy accounts) for the period = Surplus/(Deficit)."""
	_require_internal_role()
	_log_report_generated("Statement of Comprehensive Income", f" ({from_date} to {to_date})")

	rows = _account_totals("je.posting_date BETWEEN %s AND %s", (from_date, to_date))

	income_lines, expense_lines = [], []
	total_income = total_expense = 0.0
	for row in rows:
		if row.account_type == "Income":
			amount = flt(row.credit - row.debit, 2)
			income_lines.append({"account": row.account, "fund": row.fund, "amount": amount})
			total_income += amount
		elif row.account_type == "Expense":
			amount = flt(row.debit - row.credit, 2)
			expense_lines.append({"account": row.account, "fund": row.fund, "amount": amount})
			total_expense += amount

	total_income = flt(total_income, 2)
	total_expense = flt(total_expense, 2)
	surplus_deficit = flt(total_income - total_expense, 2)

	return {
		"from_date": from_date, "to_date": to_date,
		"income_lines": sorted(income_lines, key=lambda r: -r["amount"]),
		"expense_lines": sorted(expense_lines, key=lambda r: -r["amount"]),
		"total_income": total_income,
		"total_expense": total_expense,
		"surplus_deficit": surplus_deficit,
		"total_income_usd": _usd_equivalent(total_income, to_date),
		"total_expense_usd": _usd_equivalent(total_expense, to_date),
		"surplus_deficit_usd": _usd_equivalent(surplus_deficit, to_date),
	}


@frappe.whitelist()
def get_financial_position(as_of_date=None):
	"""Cumulative from inception to as_of_date, not period-bound -- a balance
	sheet is a snapshot, not a flow.

	Accumulated Funds = recorded Equity-type account balances (e.g. any
	Year-End Closing has posted into "Accumulated Fund") + net Income minus
	Expense not yet closed into Equity. This used to be computed as a pure
	plug (Assets - Liabilities), which can never fail to balance regardless
	of what the ledger actually says -- it proved nothing. is_balanced/
	imbalance_amount below is a real check: every submitted Journal Entry is
	individually debit=credit by construction, so summed across the whole
	ledger, Assets should equal Liabilities + Equity + (Income - Expense)
	exactly. A nonzero imbalance_amount means real data corruption (a
	cancelled-but-not-reversed entry, a currency-conversion rounding drift,
	or similar) -- not a matter of framing the numbers differently."""
	_require_internal_role()
	_log_report_generated("Statement of Financial Position", f" (as of {as_of_date or nowdate()})")

	as_of_date = as_of_date or nowdate()
	rows = _account_totals("je.posting_date <= %s", (as_of_date,))

	asset_lines, liability_lines, equity_lines = [], [], []
	total_assets = total_liabilities = total_equity = total_income = total_expense = 0.0
	for row in rows:
		if row.account_type == "Asset":
			amount = flt(row.debit - row.credit, 2)
			asset_lines.append({"account": row.account, "fund": row.fund, "amount": amount})
			total_assets += amount
		elif row.account_type == "Liability":
			amount = flt(row.credit - row.debit, 2)
			liability_lines.append({"account": row.account, "fund": row.fund, "amount": amount})
			total_liabilities += amount
		elif row.account_type == "Equity":
			amount = flt(row.credit - row.debit, 2)
			equity_lines.append({"account": row.account, "fund": row.fund, "amount": amount})
			total_equity += amount
		elif row.account_type == "Income":
			total_income += flt(row.credit - row.debit, 2)
		elif row.account_type == "Expense":
			total_expense += flt(row.debit - row.credit, 2)

	total_assets = flt(total_assets, 2)
	total_liabilities = flt(total_liabilities, 2)
	total_equity = flt(total_equity, 2)
	unclosed_surplus = flt(total_income - total_expense, 2)
	accumulated_funds = flt(total_equity + unclosed_surplus, 2)
	imbalance_amount = flt(total_assets - (total_liabilities + accumulated_funds), 2)

	return {
		"as_of_date": as_of_date,
		"asset_lines": sorted(asset_lines, key=lambda r: -r["amount"]),
		"liability_lines": sorted(liability_lines, key=lambda r: -r["amount"]),
		"equity_lines": sorted(equity_lines, key=lambda r: -r["amount"]),
		"total_assets": total_assets,
		"total_liabilities": total_liabilities,
		"total_equity_recorded": total_equity,
		"unclosed_surplus_deficit": unclosed_surplus,
		"accumulated_funds": accumulated_funds,
		"is_balanced": abs(imbalance_amount) < 0.01,
		"imbalance_amount": imbalance_amount,
		"total_assets_usd": _usd_equivalent(total_assets, as_of_date),
		"total_liabilities_usd": _usd_equivalent(total_liabilities, as_of_date),
		"accumulated_funds_usd": _usd_equivalent(accumulated_funds, as_of_date),
	}


@frappe.whitelist()
def reconcile_budget_lines():
	"""Cross-checks each Budget Line's own running totals (committed_amount/
	actual_spend, maintained incrementally via Budget Line.adjust() calls
	scattered across Purchase Order issuance/cancellation and Cashbook Payment
	disbursement) against a fresh recomputation from those same source
	documents -- so a missed or double .adjust() call anywhere shows up here
	instead of silently drifting the Vote-Book away from what the GL/source
	documents actually say.

	DEF-021: actual_from_source used to sum Cashbook Payment only, but
	Budget Line.actual_spend is also incremented directly by Petty Cash
	Replenishment.on_submit() (adjust(actual_delta=...)) for every
	Reimbursed Petty Cash Voucher against a line -- any Budget Line that
	has ever had petty cash spent against it showed a permanent, false
	discrepancy here even when nothing was actually wrong."""
	_require_internal_role()
	_log_report_generated("Vote-Book / Budget Line reconciliation")

	lines = frappe.get_all("Budget Line", fields=["name", "committed_amount", "actual_spend"])
	discrepancies = []
	for line in lines:
		cashbook_actual = flt(frappe.db.sql(
			"SELECT COALESCE(SUM(amount), 0) FROM `tabCashbook Payment` WHERE budget_line=%s AND docstatus=1",
			line.name,
		)[0][0], 2)
		petty_cash_actual = flt(frappe.db.sql(
			"SELECT COALESCE(SUM(amount), 0) FROM `tabPetty Cash Voucher` WHERE budget_line=%s AND status='Reimbursed' AND docstatus=1",
			line.name,
		)[0][0], 2)
		actual_from_source = flt(cashbook_actual + petty_cash_actual, 2)
		issued_po_total = flt(frappe.db.sql(
			"SELECT COALESCE(SUM(amount), 0) FROM `tabPurchase Order` WHERE budget_line=%s AND status='Issued'",
			line.name,
		)[0][0], 2)
		# An Issued PO stays Issued even once disbursed (only Payment Voucher.
		# disbursed flips) -- committed is only the still-outstanding portion,
		# netted against Cashbook Payment specifically (the only thing that
		# ever disburses an Issued PO). Petty cash is a separate spending path
		# that never goes through PO issuance/commitment at all -- netting it
		# against issued_po_total here would make committed go negative on
		# any line that's had petty cash spent against it but no PO issued.
		committed_from_source = flt(issued_po_total - cashbook_actual, 2)

		actual_diff = flt(line.actual_spend - actual_from_source, 2)
		committed_diff = flt(line.committed_amount - committed_from_source, 2)
		if actual_diff != 0 or committed_diff != 0:
			discrepancies.append({
				"budget_line": line.name,
				"recorded_actual_spend": line.actual_spend, "recomputed_actual_spend": actual_from_source, "actual_diff": actual_diff,
				"recorded_committed": line.committed_amount, "recomputed_committed": committed_from_source, "committed_diff": committed_diff,
			})

	return {"checked": len(lines), "discrepancies": discrepancies}
