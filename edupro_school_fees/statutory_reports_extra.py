"""Statutory/governance/operational reports (of the spec's 24, FR-RPT-01..24)
that don't warrant their own module: Annual School Census/EMIS Return, AGM
Pack, Capital Project Register, SDC-scoped Receipts & Payments, Safe Balance
report, Class-Level Fee Summary, Multi-Currency Trial Balance, Vote-Book
Commitment Ledger, Fixed Assets/PRAZ Disposal Register, and Audit Trail
Export. Each is a read-only aggregation over existing data -- nothing here
is stored -- following the same _require_internal_role()/on-demand-
computation shape as reports.py.
"""

import frappe
from frappe.utils import flt, nowdate

from edupro_school_fees.reports import _account_totals, _log_report_generated, _require_internal_role, _usd_equivalent
from edupro_school_fees.utils import BASE_CURRENCY, convert_amount, get_exchange_rate


@frappe.whitelist()
def get_census_return(academic_year):
	"""FR-RPT-02: Annual School Census Return (EMIS) -- headcount by grade,
	gender, boarding status, and BEAM/vulnerability classification, the shape
	MoPSE's own EMIS census submission expects."""
	_require_internal_role()
	_log_report_generated("Annual School Census Return (EMIS)", f" ({academic_year})")

	students = frappe.get_all(
		"Student",
		filters={"academic_year": academic_year, "status": "Active"},
		fields=["grade", "gender", "is_boarder", "vulnerability_classification"],
	)

	by_grade, by_gender, vulnerability_counts = {}, {"Male": 0, "Female": 0}, {}
	boarders = day_scholars = 0
	for s in students:
		grade = s.grade or "Ungraded"
		by_grade[grade] = by_grade.get(grade, 0) + 1
		if s.gender in by_gender:
			by_gender[s.gender] += 1
		if s.is_boarder:
			boarders += 1
		else:
			day_scholars += 1
		classification = s.vulnerability_classification or "Not Classified"
		vulnerability_counts[classification] = vulnerability_counts.get(classification, 0) + 1

	return {
		"academic_year": academic_year,
		"total_enrolment": len(students),
		"by_grade": sorted([{"grade": g, "count": c} for g, c in by_grade.items()], key=lambda r: r["grade"]),
		"by_gender": by_gender,
		"boarders": boarders,
		"day_scholars": day_scholars,
		"by_vulnerability_classification": sorted(
			[{"classification": k, "count": v} for k, v in vulnerability_counts.items()], key=lambda r: -r["count"]
		),
	}


@frappe.whitelist()
def get_agm_pack(academic_year):
	"""FR-RPT-10: AGM financial statement pack -- every Fee Structure that
	went before the AGM this year (Approved, with its co-signatures) plus the
	year's Receipts & Payments summary, the two things an AGM actually reviews
	together."""
	_require_internal_role()
	_log_report_generated("AGM Pack", f" ({academic_year})")

	fee_structures = frappe.get_all(
		"Fee Structure",
		filters={"academic_year": academic_year, "workflow_state": "Approved"},
		fields=[
			"name", "structure_name", "term", "beneficiary_category", "total_amount",
			"approved_by", "approved_on", "school_head_co_signed_by", "sdc_co_signed_by",
			"agm_minutes_hash",
		],
	)

	year_bounds = frappe.db.get_value("Academic Year", academic_year, ["start_date", "end_date"], as_dict=True)
	from edupro_school_fees.reports import get_receipts_and_payments
	rp_summary = None
	if year_bounds:
		rp_summary = get_receipts_and_payments(str(year_bounds.start_date), str(year_bounds.end_date))

	return {
		"academic_year": academic_year,
		"fee_structures": fee_structures,
		"receipts_and_payments": rp_summary,
	}


@frappe.whitelist()
def get_capital_project_register():
	"""FR-RPT-11: Capital Project Register -- every Budget Line flagged as a
	capital project, with its approved budget, committed and actual spend to
	date. SDC's own "monitors vote-book spending lines for infrastructure
	projects" duty (spec 4.x)."""
	_require_internal_role()
	_log_report_generated("Capital Project Register")

	return frappe.get_all(
		"Budget Line",
		filters={"is_capital_project": 1},
		fields=[
			"name", "project_name", "vote_code", "description", "fund",
			"approved_budget", "committed_amount", "actual_spend", "available_balance",
		],
		order_by="project_name asc",
	)


@frappe.whitelist()
def get_sdc_receipts_and_payments(from_date, to_date):
	"""FR-RPT-12: SDC receipts and payments summary -- the same computation as
	the school-wide Statement of Receipts and Payments, scoped to Fund B (SDC/
	SDA) cash accounts only, matching the fund-scoping already enforced on
	every other SDC-facing doctype."""
	_require_internal_role()
	_log_report_generated("SDC Receipts and Payments", f" ({from_date} to {to_date})")

	fund_b_accounts = list({
		pm.account for pm in frappe.get_all("Payment Method", fields=["account"])
		if pm.account and frappe.db.get_value("Account", pm.account, "fund") == "Fund B - SDC/SDA"
	})
	if not fund_b_accounts:
		return {"from_date": from_date, "to_date": to_date, "receipt_lines": [], "payment_lines": [], "total_receipts": 0, "total_payments": 0, "net_movement": 0}

	placeholders = ", ".join(["%s"] * len(fund_b_accounts))
	rows = frappe.db.sql(
		f"""
		SELECT je.reference_doctype,
		       COALESCE(SUM(jea.debit * jea.exchange_rate), 0) AS debit,
		       COALESCE(SUM(jea.credit * jea.exchange_rate), 0) AS credit
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		WHERE je.docstatus = 1 AND je.posting_date BETWEEN %s AND %s
		  AND jea.account IN ({placeholders}) AND je.fund = 'Fund B - SDC/SDA'
		GROUP BY je.reference_doctype
		""",
		(from_date, to_date, *fund_b_accounts),
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
	return {
		"from_date": from_date, "to_date": to_date,
		"receipt_lines": sorted(receipt_lines, key=lambda r: -r["amount"]),
		"payment_lines": sorted(payment_lines, key=lambda r: -r["amount"]),
		"total_receipts": total_receipts, "total_payments": total_payments,
		"net_movement": flt(total_receipts - total_payments, 2),
	}


@frappe.whitelist()
def get_safe_balance_report(as_of_date=None):
	"""FR-RPT-17: Safe balance and cash movement -- the GL balance of every
	cash-type Payment Method account (Cash-in-Till and similar, distinguished
	from bank accounts by naming convention isn't reliable, so this uses every
	Payment Method's account and simply labels each by its account_name)."""
	_require_internal_role()
	_log_report_generated("Safe Balance Report")

	as_of_date = as_of_date or nowdate()
	cash_methods = frappe.get_all("Payment Method", fields=["name", "method_name", "account", "currency"])
	if not cash_methods:
		return {"as_of_date": as_of_date, "balances": []}

	accounts = list({m.account for m in cash_methods if m.account})
	placeholders = ", ".join(["%s"] * len(accounts))
	balances = frappe.db.sql(
		f"""
		SELECT jea.account,
		       COALESCE(SUM(jea.debit), 0) AS debit, COALESCE(SUM(jea.credit), 0) AS credit
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		WHERE je.docstatus = 1 AND je.posting_date <= %s AND jea.account IN ({placeholders})
		GROUP BY jea.account
		""",
		(as_of_date, *accounts),
		as_dict=True,
	) if accounts else []
	balance_by_account = {row.account: flt(row.debit - row.credit, 2) for row in balances}

	return {
		"as_of_date": as_of_date,
		"balances": [
			{
				"payment_method": m.method_name, "account": m.account, "currency": m.currency,
				"balance": balance_by_account.get(m.account, 0),
			}
			for m in cash_methods
		],
	}


@frappe.whitelist()
def get_class_level_fee_summary(academic_year):
	"""FR-RPT-19: Class-level fee summary -- billed vs collected, by
	Student.grade, for every Invoice raised this academic year."""
	_require_internal_role()
	_log_report_generated("Class-Level Fee Summary", f" ({academic_year})")

	rows = frappe.db.sql(
		"""
		SELECT s.grade, COUNT(DISTINCT i.name) AS invoice_count,
		       COALESCE(SUM(i.total_amount), 0) AS total_billed,
		       COALESCE(SUM(i.total_amount - i.outstanding_amount), 0) AS total_collected,
		       COALESCE(SUM(i.outstanding_amount), 0) AS total_outstanding
		FROM `tabInvoice` i
		INNER JOIN `tabStudent` s ON s.name = i.student
		WHERE i.docstatus = 1 AND i.academic_year = %s
		GROUP BY s.grade
		ORDER BY s.grade
		""",
		academic_year,
		as_dict=True,
	)
	for row in rows:
		row.grade = row.grade or "Ungraded"
	return {"academic_year": academic_year, "rows": rows}


@frappe.whitelist()
def get_multi_currency_trial_balance(as_of_date=None):
	"""FR-RPT-20: Multi-currency trial balance -- every account's Dr/Cr
	balance in its own native currency (unconverted) alongside the
	BASE_CURRENCY-normalized figure already used for every other statement,
	and a USD equivalent for each."""
	_require_internal_role()
	_log_report_generated("Multi-Currency Trial Balance", f" (as of {as_of_date or nowdate()})")

	as_of_date = as_of_date or nowdate()
	rows = frappe.db.sql(
		"""
		SELECT jea.account, a.account_type, a.currency AS account_currency,
		       COALESCE(SUM(jea.debit), 0) AS native_debit, COALESCE(SUM(jea.credit), 0) AS native_credit,
		       COALESCE(SUM(jea.debit * jea.exchange_rate), 0) AS base_debit,
		       COALESCE(SUM(jea.credit * jea.exchange_rate), 0) AS base_credit
		FROM `tabJournal Entry Account` jea
		INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
		INNER JOIN `tabAccount` a ON a.name = jea.account
		WHERE je.docstatus = 1 AND je.posting_date <= %s
		GROUP BY jea.account, a.account_type, a.currency
		ORDER BY jea.account
		""",
		as_of_date,
		as_dict=True,
	)

	lines = []
	total_base_debit = total_base_credit = 0.0
	for row in rows:
		base_debit, base_credit = flt(row.base_debit, 2), flt(row.base_credit, 2)
		total_base_debit += base_debit
		total_base_credit += base_credit
		lines.append({
			"account": row.account, "account_type": row.account_type, "currency": row.account_currency,
			"native_debit": flt(row.native_debit, 2), "native_credit": flt(row.native_credit, 2),
			"base_debit": base_debit, "base_credit": base_credit,
			"usd_debit": _usd_equivalent(base_debit, as_of_date),
			"usd_credit": _usd_equivalent(base_credit, as_of_date),
		})

	return {
		"as_of_date": as_of_date, "base_currency": BASE_CURRENCY, "lines": lines,
		"total_base_debit": flt(total_base_debit, 2), "total_base_credit": flt(total_base_credit, 2),
		"total_usd_debit": _usd_equivalent(total_base_debit, as_of_date),
		"total_usd_credit": _usd_equivalent(total_base_credit, as_of_date),
	}


@frappe.whitelist()
def get_vote_book_commitment_ledger():
	"""FR-RPT-16: Vote-book commitment ledger -- every currently outstanding
	encumbrance (an Issued Purchase Order not yet disbursed via Cashbook
	Payment), distinct from the Vote-Book Variance Report's budget-vs-actual
	summary view."""
	_require_internal_role()
	_log_report_generated("Vote-Book Commitment Ledger")

	return frappe.db.sql(
		"""
		SELECT po.name AS purchase_order, po.budget_line, po.vendor_name, po.amount, po.currency, po.posting_date
		FROM `tabPurchase Order` po
		LEFT JOIN `tabPayment Voucher` pv ON pv.purchase_order = po.name AND pv.disbursed = 1
		WHERE po.status = 'Issued' AND pv.name IS NULL
		ORDER BY po.posting_date ASC
		""",
		as_dict=True,
	)


@frappe.whitelist()
def get_fixed_assets_disposal_register():
	"""FR-RPT-09/22, FR-FAR-01: Fixed Assets Register + PRAZ Disposal Register
	-- previously the one named statutory report in the spec with no
	implementing function at all, despite Asset already carrying every field
	the register needs (praz_reference, disposal_status/date/praz_reference,
	historical_cost/accumulated_depreciation/net_book_value from the existing
	monthly depreciation job). DEF-013."""
	_require_internal_role()
	_log_report_generated("Fixed Assets / PRAZ Disposal Register")

	assets = frappe.get_all(
		"Asset",
		fields=[
			"asset_code", "description", "praz_reference", "date_acquired",
			"historical_cost", "currency", "accumulated_depreciation", "net_book_value",
			"physical_location", "condition", "disposal_status", "disposal_date", "disposal_praz_reference",
		],
		order_by="date_acquired asc",
	)

	in_use = [a for a in assets if a.disposal_status != "Disposed"]
	disposed = [a for a in assets if a.disposal_status == "Disposed"]

	return {
		"assets": assets,
		"disposals": disposed,
		"total_assets": len(assets),
		"total_in_use": len(in_use),
		"total_disposed": len(disposed),
		"total_historical_cost": flt(sum(a.historical_cost or 0 for a in assets), 2),
		"total_accumulated_depreciation": flt(sum(a.accumulated_depreciation or 0 for a in assets), 2),
		"total_net_book_value": flt(sum(a.net_book_value or 0 for a in assets), 2),
	}


@frappe.whitelist()
def get_audit_trail_export(from_date, to_date):
	"""FR-RPT-24: Audit trail export package -- every Audit Log entry in the
	given window, in the structured shape the frontend hands to
	downloadCsv/downloadXlsx/downloadJson/exportReportPdf. Exporting the
	audit trail is itself a real config/data-egress event, so it's logged."""
	_require_internal_role()

	rows = frappe.get_all(
		"Audit Log",
		filters={"timestamp": ["between", [from_date, to_date]]},
		fields=["timestamp", "user", "role", "action", "reference_doctype", "reference_name", "justification"],
		order_by="timestamp asc",
	)

	from frappe.utils import now_datetime
	frappe.get_doc({
		"doctype": "Audit Log",
		"user": frappe.session.user,
		"role": ", ".join(frappe.get_roles(frappe.session.user)),
		"action": f"Audit Trail exported ({from_date} to {to_date}, {len(rows)} rows)",
		"timestamp": now_datetime(),
	}).insert(ignore_permissions=True)

	return {"from_date": from_date, "to_date": to_date, "rows": rows}
