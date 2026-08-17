import frappe
from frappe import _
from frappe.utils import flt

UNASSIGNED = "(Unassigned)"

# Asset balances are naturally debit-positive (balance = debit - credit).
# Liability/Equity balances are naturally credit-positive (balance = credit - debit).
SIGN_BY_ROOT_TYPE = {"Asset": 1, "Liability": -1, "Equity": -1}

SECTIONS = [
	("Asset", _("Assets")),
	("Liability", _("Liabilities")),
	("Equity", _("Fund Reserves / Equity")),
]


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


def get_balances_by_account_and_fund(company, as_on_date, root_type):
	return frappe.db.sql(
		"""
		select
			acc.name as account,
			coalesce(gle.fund, '') as fund,
			sum(gle.debit - gle.credit) as net_debit
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where gle.company = %(company)s
		  and gle.posting_date <= %(as_on_date)s
		  and gle.is_cancelled = 0
		  and acc.root_type = %(root_type)s
		  and acc.is_group = 0
		group by acc.name, gle.fund
		""",
		{"company": company, "as_on_date": as_on_date, "root_type": root_type},
		as_dict=True,
	)


def get_data(filters, fund_names):
	company = filters.get("company") or frappe.db.get_single_value("Global Defaults", "default_company")
	as_on_date = filters.get("as_on_date")

	if not (company and as_on_date):
		return []

	data = []
	section_totals = {}

	for root_type, label in SECTIONS:
		data.append({"account": label})
		rows = get_balances_by_account_and_fund(company, as_on_date, root_type)
		section_totals[root_type] = build_section(data, rows, fund_names, sign=SIGN_BY_ROOT_TYPE[root_type])

	# Fundamental accounting check: Assets - Liabilities - Equity should net to zero per fund.
	check_row = {"account": _("Net Position (Assets - Liabilities - Equity)")}
	grand_total = 0
	for fund in fund_names:
		key = frappe.scrub(fund)
		# section_totals already store each root type's natural-positive balance
		# (sign applied in build_section), so this is a plain Assets - Liabilities - Equity.
		net = section_totals["Asset"][fund] - section_totals["Liability"][fund] - section_totals["Equity"][fund]
		check_row[key] = net
		grand_total += net
	check_row["total"] = grand_total
	data.append(check_row)

	return data


def build_section(data, rows, fund_names, sign):
	by_account = {}
	totals_by_fund = {fund: 0 for fund in fund_names}

	for row in rows:
		fund = row.fund or UNASSIGNED
		if fund not in totals_by_fund:
			continue
		amount = flt(row.net_debit) * sign
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

	subtotal = {"account": _("Subtotal")}
	subtotal_total = 0
	for fund in fund_names:
		key = frappe.scrub(fund)
		subtotal[key] = totals_by_fund[fund]
		subtotal_total += totals_by_fund[fund]
	subtotal["total"] = subtotal_total
	data.append(subtotal)

	return totals_by_fund
