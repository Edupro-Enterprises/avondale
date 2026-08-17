import frappe
from frappe.utils import flt


@frappe.whitelist()
def get_filter_options():
	return {
		"funds": frappe.get_all("Fund", fields=["name"], order_by="name"),
		"currencies": frappe.get_all(
			"Currency", filters={"enabled": 1}, fields=["name"], order_by="name"
		),
		"voucher_types": [
			d.voucher_type
			for d in frappe.get_all(
				"GL Entry", fields=["voucher_type"], distinct=True, order_by="voucher_type"
			)
		],
	}


@frappe.whitelist()
def get_ledger_entries(from_date=None, to_date=None, fund=None, account=None, currency=None, voucher_type=None):
	conditions = ["gle.is_cancelled = 0"]
	values = {}

	if from_date:
		conditions.append("gle.posting_date >= %(from_date)s")
		values["from_date"] = from_date
	if to_date:
		conditions.append("gle.posting_date <= %(to_date)s")
		values["to_date"] = to_date
	if fund:
		conditions.append("gle.fund = %(fund)s")
		values["fund"] = fund
	if account:
		conditions.append("gle.account = %(account)s")
		values["account"] = account
	if currency:
		conditions.append("gle.account_currency = %(currency)s")
		values["currency"] = currency
	if voucher_type:
		conditions.append("gle.voucher_type = %(voucher_type)s")
		values["voucher_type"] = voucher_type

	rows = frappe.db.sql(
		f"""
		select
			gle.posting_date, gle.account, gle.account_currency, gle.fund,
			gle.voucher_type, gle.voucher_no, gle.against, gle.party,
			gle.debit, gle.credit,
			gle.debit_in_account_currency, gle.credit_in_account_currency,
			gle.remarks
		from `tabGL Entry` gle
		where {" and ".join(conditions)}
		order by gle.posting_date asc, gle.creation asc
		""",
		values,
		as_dict=True,
	)

	running_balance = 0
	totals_by_currency = {}

	for row in rows:
		running_balance += flt(row.debit) - flt(row.credit)
		row["running_balance"] = running_balance

		bucket = totals_by_currency.setdefault(
			row.account_currency,
			{"debit": 0, "credit": 0, "debit_in_account_currency": 0, "credit_in_account_currency": 0},
		)
		bucket["debit"] += flt(row.debit)
		bucket["credit"] += flt(row.credit)
		bucket["debit_in_account_currency"] += flt(row.debit_in_account_currency)
		bucket["credit_in_account_currency"] += flt(row.credit_in_account_currency)

	return {"entries": rows, "totals_by_currency": totals_by_currency}
