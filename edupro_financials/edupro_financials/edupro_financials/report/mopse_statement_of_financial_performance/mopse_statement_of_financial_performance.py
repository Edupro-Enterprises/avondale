import frappe
from frappe import _
from frappe.utils import flt, getdate

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
			{
				"label": fund,
				"fieldname": frappe.scrub(fund),
				"fieldtype": "Currency",
				"width": 160,
			}
		)
	columns.append({"label": _("Total"), "fieldname": "total", "fieldtype": "Currency", "width": 160})
	return columns


def get_amounts_by_account_and_fund(company, from_date, to_date, root_type):
	conditions = [
		"gle.company = %(company)s",
		"gle.posting_date between %(from_date)s and %(to_date)s",
		"gle.is_cancelled = 0",
		"acc.root_type = %(root_type)s",
		"acc.is_group = 0",
	]
	values = {
		"company": company,
		"from_date": from_date,
		"to_date": to_date,
		"root_type": root_type,
	}

	rows = frappe.db.sql(
		f"""
		select
			acc.name as account,
			coalesce(gle.fund, '') as fund,
			sum(gle.credit - gle.debit) as net_credit
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where {' and '.join(conditions)}
		group by acc.name, gle.fund
		""",
		values,
		as_dict=True,
	)
	return rows


def get_data(filters, fund_names):
	company = filters.get("company") or frappe.db.get_single_value("Global Defaults", "default_company")
	from_date = filters.get("from_date")
	to_date = filters.get("to_date")

	if not (company and from_date and to_date):
		return []

	income_rows = get_amounts_by_account_and_fund(company, from_date, to_date, "Income")
	expense_rows = get_amounts_by_account_and_fund(company, from_date, to_date, "Expense")

	data = []
	data.append({"account": _("Income")})
	income_total_by_fund = build_section(data, income_rows, fund_names, sign=1)

	data.append({"account": _("Expenditure")})
	expense_total_by_fund = build_section(data, expense_rows, fund_names, sign=-1)

	surplus_row = {"account": _("Net Surplus / (Deficit)")}
	grand_total = 0
	for fund in fund_names:
		key = frappe.scrub(fund)
		net = flt(income_total_by_fund.get(fund, 0)) + flt(expense_total_by_fund.get(fund, 0))
		surplus_row[key] = net
		grand_total += net
	surplus_row["total"] = grand_total
	data.append(surplus_row)

	return data


def build_section(data, rows, fund_names, sign):
	by_account = {}
	totals_by_fund = {fund: 0 for fund in fund_names}

	for row in rows:
		fund = row.fund or UNASSIGNED
		if fund not in totals_by_fund:
			continue
		amount = flt(row.net_credit) * sign
		by_account.setdefault(row.account, {})[fund] = by_account.get(row.account, {}).get(fund, 0) + amount
		totals_by_fund[fund] += amount

	for account in sorted(by_account.keys()):
		fund_amounts = by_account[account]
		line = {"account": account}
		line_total = 0
		for fund in fund_names:
			key = frappe.scrub(fund)
			amount = flt(fund_amounts.get(fund, 0))
			line[key] = amount
			line_total += amount
		line["total"] = line_total
		data.append(line)

	subtotal = {"account": _("Total")}
	subtotal_total = 0
	for fund in fund_names:
		key = frappe.scrub(fund)
		subtotal[key] = totals_by_fund[fund]
		subtotal_total += totals_by_fund[fund]
	subtotal["total"] = subtotal_total
	data.append(subtotal)

	return totals_by_fund
