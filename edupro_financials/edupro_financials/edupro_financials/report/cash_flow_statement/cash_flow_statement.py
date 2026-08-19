import frappe
from frappe import _
from frappe.utils import add_days, flt

UNASSIGNED = "(Unassigned)"

CATEGORIES = ["Operating", "Investing", "Financing"]
CATEGORY_LABELS = {
	"Operating": _("Net Cash from Operating Activities"),
	"Investing": _("Net Cash from Investing Activities"),
	"Financing": _("Net Cash from Financing Activities"),
}


def execute(filters=None):
	filters = filters or {}
	funds = frappe.get_all("Fund", fields=["name"], order_by="name")
	fund_names = [f.name for f in funds] + [UNASSIGNED]

	columns = get_columns(fund_names)
	data = get_data(filters, fund_names)
	return columns, data


def get_columns(fund_names):
	columns = [
		{"label": _("Account"), "fieldname": "account", "fieldtype": "Data", "width": 300},
	]
	for fund in fund_names:
		columns.append(
			{"label": fund, "fieldname": frappe.scrub(fund), "fieldtype": "Currency", "width": 160}
		)
	columns.append({"label": _("Total"), "fieldname": "total", "fieldtype": "Currency", "width": 160})
	return columns


def get_cash_accounts(company):
	return frappe.get_all(
		"Account",
		filters={"company": company, "account_type": ["in", ["Cash", "Bank"]], "is_group": 0},
		pluck="name",
	)


def classify_voucher(counter_lines):
	"""Direct-method classification of a voucher's cash movement, based on the
	nature of the non-cash account(s) it was posted against. Fixed Asset
	movements are Investing, Equity/Loan movements are Financing, and
	everything else (Income/Expense/Receivable/Payable - the vast majority of
	a school's activity: fee receipts, IGP sales, supplier payments) is
	Operating.
	"""
	root_types = {line.root_type for line in counter_lines}
	account_types = {line.account_type for line in counter_lines}

	if "Fixed Asset" in account_types:
		return "Investing"
	if "Equity" in root_types or "Loan" in account_types:
		return "Financing"
	return "Operating"


def get_cash_movements(company, from_date, to_date):
	cash_accounts = get_cash_accounts(company)
	if not cash_accounts:
		return []

	cash_lines = frappe.db.sql(
		"""
		select voucher_no, coalesce(fund, '') as fund, sum(debit - credit) as net_movement
		from `tabGL Entry`
		where company = %(company)s
		  and posting_date between %(from_date)s and %(to_date)s
		  and is_cancelled = 0
		  and account in %(accounts)s
		group by voucher_no, fund
		""",
		{"company": company, "from_date": from_date, "to_date": to_date, "accounts": cash_accounts},
		as_dict=True,
	)
	if not cash_lines:
		return []

	voucher_nos = list({line.voucher_no for line in cash_lines})
	counter_lines = frappe.db.sql(
		"""
		select gle.voucher_no, acc.root_type, acc.account_type
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where gle.voucher_no in %(vouchers)s
		  and gle.account not in %(accounts)s
		  and gle.is_cancelled = 0
		""",
		{"vouchers": voucher_nos, "accounts": cash_accounts},
		as_dict=True,
	)
	lines_by_voucher = {}
	for line in counter_lines:
		lines_by_voucher.setdefault(line.voucher_no, []).append(line)

	movements = []
	for cl in cash_lines:
		category = classify_voucher(lines_by_voucher.get(cl.voucher_no, []))
		movements.append(
			{"category": category, "fund": cl.fund or UNASSIGNED, "amount": flt(cl.net_movement)}
		)
	return movements


def get_cash_balance_by_fund(company, as_on_date, fund_names):
	cash_accounts = get_cash_accounts(company)
	totals = {fund: 0 for fund in fund_names}
	if not cash_accounts:
		return totals

	rows = frappe.db.sql(
		"""
		select coalesce(fund, '') as fund, sum(debit - credit) as net_debit
		from `tabGL Entry`
		where company = %(company)s
		  and posting_date <= %(as_on_date)s
		  and is_cancelled = 0
		  and account in %(accounts)s
		group by fund
		""",
		{"company": company, "as_on_date": as_on_date, "accounts": cash_accounts},
		as_dict=True,
	)
	for row in rows:
		fund = row.fund or UNASSIGNED
		if fund in totals:
			totals[fund] += flt(row.net_debit)
	return totals


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

	movements = get_cash_movements(company, from_date, to_date)

	data = []
	net_change = {fund: 0 for fund in fund_names}

	for category in CATEGORIES:
		totals = {fund: 0 for fund in fund_names}
		for m in movements:
			if m["category"] != category:
				continue
			fund = m["fund"] if m["fund"] in totals else UNASSIGNED
			totals[fund] += m["amount"]
		for fund in fund_names:
			net_change[fund] += totals[fund]
		data.append(make_row(CATEGORY_LABELS[category], totals, fund_names))

	opening = get_cash_balance_by_fund(company, add_days(from_date, -1), fund_names)
	closing = {fund: opening[fund] + net_change[fund] for fund in fund_names}

	data.append(make_row(_("Net Increase / (Decrease) in Cash"), net_change, fund_names))
	data.append(make_row(_("Cash at Beginning of Period"), opening, fund_names))
	data.append(make_row(_("Cash at End of Period"), closing, fund_names))

	return data
