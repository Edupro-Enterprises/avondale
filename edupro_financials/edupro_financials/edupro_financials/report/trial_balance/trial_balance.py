import frappe
from frappe import _
from frappe.utils import flt


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": _("Account"), "fieldname": "account", "fieldtype": "Data", "width": 320},
		{"label": _("Debit"), "fieldname": "debit", "fieldtype": "Currency", "width": 160},
		{"label": _("Credit"), "fieldname": "credit", "fieldtype": "Currency", "width": 160},
	]


def get_data(filters):
	company = filters.get("company") or frappe.db.get_single_value("Global Defaults", "default_company")
	as_on_date = filters.get("as_on_date")

	if not (company and as_on_date):
		return []

	# Traditional flat trial balance - all funds combined, one Debit/Credit
	# column pair per account. Fund-level detail belongs to the Statement of
	# Financial Performance/Position instead (see statutory_reports.py).
	rows = frappe.db.sql(
		"""
		select acc.name as account, sum(gle.debit - gle.credit) as net_debit
		from `tabGL Entry` gle
		inner join `tabAccount` acc on acc.name = gle.account
		where gle.company = %(company)s
		  and gle.posting_date <= %(as_on_date)s
		  and gle.is_cancelled = 0
		  and acc.is_group = 0
		group by acc.name
		having sum(gle.debit - gle.credit) != 0
		order by acc.name
		""",
		{"company": company, "as_on_date": as_on_date},
		as_dict=True,
	)

	data = []
	total_debit = 0
	total_credit = 0
	for row in rows:
		net = flt(row.net_debit)
		debit = net if net > 0 else 0
		credit = -net if net < 0 else 0
		data.append({"account": row.account, "debit": debit, "credit": credit})
		total_debit += debit
		total_credit += credit

	data.append({"account": _("Total"), "debit": total_debit, "credit": total_credit})
	return data
