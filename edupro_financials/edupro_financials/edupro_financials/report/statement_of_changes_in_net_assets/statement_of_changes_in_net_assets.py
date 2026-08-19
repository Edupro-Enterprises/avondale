import frappe
from frappe import _
from frappe.utils import add_days, flt

UNASSIGNED = "(Unassigned)"


def execute(filters=None):
	filters = filters or {}
	funds = frappe.get_all("Fund", fields=["name"], order_by="name")
	fund_names = [f.name for f in funds] + [UNASSIGNED]

	columns = get_columns(fund_names)
	data = get_data(filters, fund_names)
	return columns, data


def get_columns(fund_names):
	columns = [
		{"label": _("Account"), "fieldname": "account", "fieldtype": "Data", "width": 260},
	]
	for fund in fund_names:
		columns.append(
			{"label": fund, "fieldname": frappe.scrub(fund), "fieldtype": "Currency", "width": 160}
		)
	columns.append({"label": _("Total"), "fieldname": "total", "fieldtype": "Currency", "width": 160})
	return columns


def get_equity_by_fund(company, as_on_date, fund_names):
	rows = frappe.db.sql(
		"""
		select coalesce(gle.fund, '') as fund, sum(gle.credit - gle.debit) as net_credit
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where gle.company = %(company)s
		  and gle.posting_date <= %(as_on_date)s
		  and gle.is_cancelled = 0
		  and acc.root_type = 'Equity'
		  and acc.is_group = 0
		group by gle.fund
		""",
		{"company": company, "as_on_date": as_on_date},
		as_dict=True,
	)
	totals = {fund: 0 for fund in fund_names}
	for row in rows:
		fund = row.fund or UNASSIGNED
		if fund in totals:
			totals[fund] += flt(row.net_credit)
	return totals


def get_surplus_by_fund(company, from_date, to_date, fund_names):
	def amounts(root_type, sign):
		rows = frappe.db.sql(
			"""
			select coalesce(gle.fund, '') as fund, sum(gle.credit - gle.debit) as net_credit
			from `tabGL Entry` gle
			inner join `tabAccount` acc on acc.name = gle.account
			where gle.company = %(company)s
			  and gle.posting_date between %(from_date)s and %(to_date)s
			  and gle.is_cancelled = 0
			  and acc.root_type = %(root_type)s
			  and acc.is_group = 0
			group by gle.fund
			""",
			{"company": company, "from_date": from_date, "to_date": to_date, "root_type": root_type},
			as_dict=True,
		)
		totals = {fund: 0 for fund in fund_names}
		for row in rows:
			fund = row.fund or UNASSIGNED
			if fund in totals:
				totals[fund] += flt(row.net_credit) * sign
		return totals

	income = amounts("Income", 1)
	expense = amounts("Expense", -1)
	return {fund: income[fund] + expense[fund] for fund in fund_names}


def make_row(label, values, fund_names):
	row = {"account": label}
	total = 0
	for fund in fund_names:
		key = frappe.scrub(fund)
		row[key] = values[fund]
		total += values[fund]
	row["total"] = total
	return row


def get_data(filters, fund_names):
	company = filters.get("company") or frappe.db.get_single_value("Global Defaults", "default_company")
	from_date = filters.get("from_date")
	to_date = filters.get("to_date")

	if not (company and from_date and to_date):
		return []

	opening_date = add_days(from_date, -1)
	opening = get_equity_by_fund(company, opening_date, fund_names)
	surplus = get_surplus_by_fund(company, from_date, to_date, fund_names)
	closing = {fund: opening[fund] + surplus[fund] for fund in fund_names}

	return [
		make_row(_("Opening Balance"), opening, fund_names),
		make_row(_("Surplus / (Deficit) for the Period"), surplus, fund_names),
		make_row(_("Closing Balance"), closing, fund_names),
	]
