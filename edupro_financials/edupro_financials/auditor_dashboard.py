import frappe
from frappe.utils import add_days, cint, nowdate

from edupro_financials.receipts import get_receipt_sequence_gaps

# doctypes checked for backdated vouchers, mapped to their posting-date fieldname
BACKDATE_CHECK_DOCTYPES = {
	"Sales Invoice": "posting_date",
	"Purchase Order": "transaction_date",
	"Payment Entry": "posting_date",
	"Journal Entry": "posting_date",
}

# posting_date more than this many days before creation is flagged as backdated
BACKDATE_THRESHOLD_DAYS = 3


@frappe.whitelist()
def get_exceptions(days=30):
	days = cint(days) or 30
	from_date = add_days(nowdate(), -days)

	return {
		"cancelled_receipts": get_cancelled_receipts(from_date),
		"manual_cash_entries": get_manual_cash_entries(from_date),
		"backdated_vouchers": get_backdated_vouchers(from_date),
		"unreconciled_till_balances": get_unreconciled_till(from_date),
		"receipt_sequence_gaps": get_receipt_sequence_gaps(),
	}


def get_cancelled_receipts(from_date):
	return frappe.get_all(
		"Fees",
		filters={"docstatus": 2, "modified": [">=", from_date]},
		fields=["name", "student_name", "grand_total", "modified", "owner"],
		order_by="modified desc",
		limit_page_length=50,
	)


def get_manual_cash_entries(from_date):
	return frappe.db.sql(
		"""
		select je.name, je.posting_date, je.total_debit, je.user_remark, je.owner
		from `tabJournal Entry` je
		inner join `tabJournal Entry Account` jea on jea.parent = je.name
		inner join `tabAccount` acc on acc.name = jea.account
		where je.docstatus = 1
		  and acc.account_type = 'Cash'
		  and je.posting_date >= %(from_date)s
		group by je.name
		order by je.posting_date desc
		limit 50
		""",
		{"from_date": from_date},
		as_dict=True,
	)


def get_backdated_vouchers(from_date):
	results = []
	for doctype, date_field in BACKDATE_CHECK_DOCTYPES.items():
		rows = frappe.db.sql(
			f"""
			select name, {date_field} as posting_date, creation, owner
			from `tab{doctype}`
			where docstatus = 1
			  and datediff(date(creation), {date_field}) > {BACKDATE_THRESHOLD_DAYS}
			  and creation >= %(from_date)s
			order by creation desc
			limit 20
			""",
			{"from_date": from_date},
			as_dict=True,
		)
		for row in rows:
			row["doctype"] = doctype
		results.extend(rows)
	return results


def get_unreconciled_till(from_date):
	return frappe.get_all(
		"Daily Cashier Reconciliation",
		filters={"variance_usd": ["!=", 0], "reconciliation_date": [">=", from_date]},
		fields=["name", "cashier_user", "reconciliation_date", "variance_usd", "docstatus"],
		order_by="reconciliation_date desc",
		limit_page_length=50,
	)
