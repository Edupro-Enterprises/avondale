"""Summary data for the Headmaster / SDC Chairperson oversight portal
page - a single call aggregating what those two statutory-oversight
roles need at a glance, rather than making them read the full reports.
"""

import frappe
from frappe.utils import flt

UNASSIGNED = "(Unassigned)"


@frappe.whitelist()
def get_summary():
	company = frappe.db.get_single_value("Global Defaults", "default_company")

	return {
		"total_arrears_outstanding": get_total_arrears(),
		"arrears_by_fee_category": get_arrears_by_fee_category(),
		"billed_by_fee_category": get_billed_by_fee_category(),
		"fund_balances": get_fund_balances(company),
		"vote_book_summary": get_vote_book_summary(),
	}


def get_total_arrears():
	# Gross, not net: a credit balance on one student's account is that
	# student's money, not an offset against what a *different* student
	# owes - summing every record regardless of sign would let credits
	# silently hide real arrears in the headline number. Matches the
	# same outstanding_amount > 0 filter age_analyzed_fee_arrears_schedule
	# uses.
	total = frappe.db.sql(
		"select coalesce(sum(outstanding_amount), 0) from `tabFees` where docstatus = 1 and outstanding_amount > 0"
	)[0][0]
	return flt(total)


def get_arrears_by_fee_category():
	"""Outstanding balances split by fund - Levy sits on the SDC/SDA fund,
	Tuition on the Tuition/Government fund, so this is the same split the
	spec calls "Levy and Tuition fees (SDC and Tuition)", just read off the
	fund each Fees record already carries rather than re-deriving it.
	Gross like get_total_arrears() above - see that comment."""
	rows = frappe.db.sql(
		"""
		select coalesce(fund, %(unassigned)s) as fund, coalesce(sum(outstanding_amount), 0) as amount
		from `tabFees`
		where docstatus = 1 and outstanding_amount > 0
		group by coalesce(fund, %(unassigned)s)
		""",
		{"unassigned": UNASSIGNED},
		as_dict=True,
	)
	return [{"fund": r.fund, "amount": flt(r.amount)} for r in rows]


def get_billed_by_fee_category():
	"""Total amount ever billed (grand_total, not just what's still
	outstanding) split the same way - lets the dashboard show "$150 Levy /
	$20 Tuition billed" alongside what's still owed."""
	rows = frappe.db.sql(
		"""
		select coalesce(fund, %(unassigned)s) as fund, coalesce(sum(grand_total), 0) as amount
		from `tabFees`
		where docstatus = 1
		group by coalesce(fund, %(unassigned)s)
		""",
		{"unassigned": UNASSIGNED},
		as_dict=True,
	)
	return [{"fund": r.fund, "amount": flt(r.amount)} for r in rows]


def get_fund_balances(company):
	"""Net surplus/(deficit) per fund - Income minus Expense. A plain
	debit-credit sum across every account indiscriminately would net a
	fund's Income against its own Assets (Debtors) and always land near
	zero for ordinary double-entry postings, since one side is debit-natured
	and the other credit-natured. This mirrors the (correct) logic already
	used in the MoPSE Statement of Financial Performance report."""
	if not company:
		return []

	rows = frappe.db.sql(
		"""
		select
			coalesce(gle.fund, %(unassigned)s) as fund,
			sum(case when acc.root_type = 'Income' then gle.credit - gle.debit
			         when acc.root_type = 'Expense' then -(gle.debit - gle.credit)
			         else 0 end) as balance
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where gle.company = %(company)s and gle.is_cancelled = 0
		  and acc.root_type in ('Income', 'Expense')
		group by coalesce(gle.fund, %(unassigned)s)
		order by fund
		""",
		{"company": company, "unassigned": UNASSIGNED},
		as_dict=True,
	)
	return [{"fund": r.fund, "balance": flt(r.balance)} for r in rows]


def get_vote_book_summary():
	row = frappe.db.sql(
		"""
		select
			coalesce(sum(approved_budget), 0) as approved,
			coalesce(sum(committed_amount), 0) as committed,
			coalesce(sum(actual_spent), 0) as spent
		from `tabVote Book Allocation`
		""",
		as_dict=True,
	)[0]
	approved = flt(row.approved)
	committed = flt(row.committed)
	spent = flt(row.spent)
	return {
		"approved": approved,
		"committed": committed,
		"spent": spent,
		"available": approved - (committed + spent),
	}
