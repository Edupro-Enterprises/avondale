"""Notes to the Financial Statements - the narrative disclosure schedule
that accompanies the MoPSE Statement of Financial Performance/Position.
Note numbering follows the technical spec: Note 10 = fee arrears aging,
Note 11 = bank/cash float balances.
"""

import frappe
from frappe.utils import flt

ACCOUNTING_POLICIES = [
	{
		"title": "Basis of Preparation",
		"text": (
			"These financial statements are prepared on the accrual basis of accounting "
			"and comply with the Ministry of Primary and Secondary Education (MoPSE) "
			"statutory reporting requirements for Zimbabwean primary schools."
		),
	},
	{
		"title": "Fund Accounting Policy",
		"text": (
			"The school maintains strict segregation of funds at the database entry level "
			"using Accounting Dimensions attached to every GL Entry, Sales Invoice/Fee, "
			"Purchase Order and Payment Entry. Four statutory funds are recognised: "
			"SDC/SDA (development levies and capital works), Tuition/General Government "
			"(government tuition and administrative running costs), BEAM & Donor Restricted "
			"(donor and government assistance grants, tracked to individual beneficiaries), "
			"and Income-Generating Projects (enterprise sub-ledgers netted to SDC on surplus)."
		),
	},
	{
		"title": "Foreign Currency Policy",
		"text": (
			"The school's functional and presentation currency is the United States Dollar "
			"(USD). Transactions denominated in Zimbabwe Gold (ZiG) are translated to USD at "
			"the official rate in force on the date of the transaction. The exchange rate is "
			"fixed and updated periodically per the MoPSE-approved schedule rather than a "
			"live market feed. Retrospective modification of the exchange rate on a submitted "
			"entry is not permitted; revaluation of outstanding ZiG-denominated balances upon "
			"a rate change is recorded as a system-generated Exchange Gain/Loss Journal Entry."
		),
	},
	{
		"title": "Revenue Recognition",
		"text": (
			"Tuition and levy fees are recognised as revenue when invoiced to the student's "
			"account (Fees doctype), net of any approved BEAM, staff, or hardship exemption. "
			"Donor and grant income is recognised on receipt and restricted to the purpose "
			"specified by the donor."
		),
	},
]


@frappe.whitelist()
def get_notes(academic_year=None, as_on_date=None):
	from frappe.utils import nowdate

	as_on_date = as_on_date or nowdate()
	company = frappe.db.get_single_value("Global Defaults", "default_company")

	return {
		"as_on_date": as_on_date,
		"academic_year": academic_year,
		"accounting_policies": ACCOUNTING_POLICIES,
		"note_10_arrears_aging": get_note_10_arrears_aging(as_on_date),
		"note_11_bank_cash_balances": get_note_11_bank_cash_balances(company, as_on_date),
		"mopse_fee_approval_reconciliation": get_mopse_reconciliation(academic_year),
	}


def get_note_10_arrears_aging(as_on_date):
	"""Summary (not per-student) aging bucket totals - the detail lives in
	the Age-Analyzed Fee Arrears Schedule report; this note discloses the
	totals that feed the receivables line on the Statement of Financial
	Position."""
	from frappe.utils import date_diff, getdate

	rows = frappe.db.sql(
		"""
		select fees.due_date, fees.outstanding_amount, fees.currency
		from `tabFees` fees
		where fees.docstatus = 1 and fees.outstanding_amount > 0
		""",
		as_dict=True,
	)

	buckets = {"Current": 0.0, "1 Term": 0.0, "2 Terms": 0.0, "3+ Terms (Prior Years)": 0.0}
	for row in rows:
		days_overdue = date_diff(getdate(as_on_date), row.due_date) if row.due_date else 0
		if days_overdue <= 0:
			buckets["Current"] += flt(row.outstanding_amount)
		elif days_overdue <= 90:
			buckets["1 Term"] += flt(row.outstanding_amount)
		elif days_overdue <= 180:
			buckets["2 Terms"] += flt(row.outstanding_amount)
		else:
			buckets["3+ Terms (Prior Years)"] += flt(row.outstanding_amount)

	total = sum(buckets.values())
	return {"buckets": buckets, "total": total}


def get_note_11_bank_cash_balances(company, as_on_date):
	if not company:
		return []

	rows = frappe.db.sql(
		"""
		select
			acc.name as account,
			acc.account_currency as currency,
			sum(gle.debit - gle.credit) as balance
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where gle.company = %(company)s
		  and gle.posting_date <= %(as_on_date)s
		  and gle.is_cancelled = 0
		  and acc.account_type in ('Cash', 'Bank')
		  and acc.is_group = 0
		group by acc.name, acc.account_currency
		order by acc.name
		""",
		{"company": company, "as_on_date": as_on_date},
		as_dict=True,
	)
	return [{"account": r.account, "currency": r.currency, "balance": flt(r.balance)} for r in rows]


def get_mopse_reconciliation(academic_year):
	filters = {"docstatus": ["!=", 2]}
	if academic_year:
		filters["academic_year"] = academic_year

	approvals = frappe.get_all(
		"MoPSE Fee Approval",
		filters=filters,
		fields=["name", "academic_year", "term", "approval_ref_number", "approved_usd_fee", "docstatus"],
	)

	rows = []
	for approval in approvals:
		# Only count Fee Structures actually tied to a fund - i.e. real,
		# ongoing billing structures (Levy, Tuition). The "Opening Arrears
		# (Migrated)" structure used to carry forward legacy Pastel debt has
		# no fund and a $1 placeholder template amount; it is not part of
		# what MoPSE approved for this year and must not be summed in here.
		actual_structure_total = frappe.db.sql(
			"""
			select coalesce(sum(fc.amount), 0)
			from `tabFee Structure` fs
			inner join `tabFee Component` fc on fc.parent = fs.name
			where fs.academic_year = %(academic_year)s
			  and fs.docstatus != 2
			  and fs.fund is not null and fs.fund != ''
			""",
			{"academic_year": approval.academic_year},
		)[0][0]

		rows.append(
			{
				"name": approval.name,
				"academic_year": approval.academic_year,
				"term": approval.term,
				"approval_ref_number": approval.approval_ref_number,
				"approved_usd_fee": flt(approval.approved_usd_fee),
				"actual_fee_structure_total": flt(actual_structure_total),
				"within_approved_limit": flt(actual_structure_total) <= flt(approval.approved_usd_fee),
				"submitted": approval.docstatus == 1,
			}
		)
	return rows
