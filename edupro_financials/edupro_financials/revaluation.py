"""Exchange Gain/Loss revaluation (spec section 4.2).

The system's exchange rate is fixed and updated periodically (not a live
feed), and retrospective modification of the rate on an already-submitted
entry is blocked. When the official rate changes, every ZiG-denominated
account's book value needs to be brought in line with the new rate - the
difference is a real, system-generated Exchange Gain/Loss, never a manual
edit to historic entries.
"""

import frappe
from frappe import _
from frappe.utils import flt, nowdate

EXCHANGE_GAIN_LOSS_ACCOUNT = "Exchange Gain/Loss - APS"


@frappe.whitelist()
def revalue_zig_accounts(new_rate, posting_date=None):
	"""new_rate is expressed as USD per 1 ZiG (matching the convention used
	throughout the system: exchange_rate * zig_amount = usd_amount)."""
	new_rate = flt(new_rate)
	if new_rate <= 0:
		frappe.throw(_("Exchange rate must be a positive number."))

	posting_date = posting_date or nowdate()
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	ensure_exchange_gain_loss_account(company)

	zig_accounts = frappe.get_all(
		"Account",
		filters={"company": company, "account_currency": "ZiG", "is_group": 0},
		fields=["name"],
	)

	journal_entries = []
	for acc in zig_accounts:
		result = revalue_account(acc.name, new_rate, posting_date, company)
		if result:
			journal_entries.append(result)

	frappe.db.commit()
	return {"revalued_accounts": len(journal_entries), "journal_entries": journal_entries}


def revalue_account(account, new_rate, posting_date, company):
	balances = frappe.db.sql(
		"""
		select
			coalesce(sum(gle.debit_in_account_currency - gle.credit_in_account_currency), 0) as zig_balance,
			coalesce(sum(gle.debit - gle.credit), 0) as current_usd_book_value,
			gle.fund as fund
		from `tabGL Entry` gle
		where gle.account = %(account)s and gle.is_cancelled = 0
		group by gle.fund
		""",
		{"account": account},
		as_dict=True,
	)

	entries = []
	for row in balances:
		zig_balance = flt(row.zig_balance)
		if not zig_balance:
			continue

		new_usd_value = zig_balance * new_rate
		gain_or_loss = new_usd_value - flt(row.current_usd_book_value)

		if abs(gain_or_loss) < 0.01:
			continue

		je = post_revaluation_entry(account, row.fund, gain_or_loss, new_rate, posting_date, company)
		entries.append(je)

	return entries


def post_revaluation_entry(account, fund, gain_or_loss, new_rate, posting_date, company):
	is_gain = gain_or_loss > 0
	amount = abs(gain_or_loss)

	account_row = {
		"account": account,
		"account_currency": "ZiG",
		"exchange_rate": new_rate,
		"fund": fund,
	}
	gl_row = {
		"account": EXCHANGE_GAIN_LOSS_ACCOUNT,
		"account_currency": "USD",
		"exchange_rate": 1,
		"fund": fund,
	}

	if is_gain:
		account_row["debit_in_account_currency"] = 0
		account_row["credit_in_account_currency"] = 0
		account_row["debit"] = amount
		gl_row["credit"] = amount
	else:
		account_row["debit"] = 0
		gl_row["debit"] = amount
		gl_row["credit"] = 0
		account_row["credit"] = amount

	je = frappe.get_doc(
		{
			"doctype": "Journal Entry",
			# "Exchange Gain Or Loss" is the one voucher_type ERPNext's own
			# Journal Entry controller special-cases in
			# set_amounts_in_company_currency() - it skips recomputing
			# debit/credit from debit_in_account_currency * exchange_rate,
			# which is exactly what a pure revaluation needs: the ZiG amount
			# doesn't move, only its USD-equivalent valuation does. Without
			# this, the controller silently overwrites our debit/credit back
			# to debit_in_account_currency * exchange_rate = 0.
			"voucher_type": "Exchange Gain Or Loss",
			"company": company,
			"posting_date": posting_date,
			"multi_currency": 1,
			"user_remark": (
				f"System-generated exchange {'gain' if is_gain else 'loss'} revaluation of {account} "
				f"at new rate {new_rate} USD/ZiG (spec section 4.2 - rate lock, no retrospective edits)."
			),
			"accounts": [account_row, gl_row],
		}
	)
	je.insert(ignore_permissions=True)
	je.submit()
	return je.name


def ensure_exchange_gain_loss_account(company):
	if frappe.db.exists("Account", EXCHANGE_GAIN_LOSS_ACCOUNT):
		return
	parent = frappe.db.get_value("Account", "Indirect Income - APS", "parent_account")
	frappe.get_doc(
		{
			"doctype": "Account",
			"account_name": "Exchange Gain/Loss",
			"parent_account": parent,
			"company": company,
			"account_currency": "USD",
			"root_type": "Income",
			"is_group": 0,
		}
	).insert(ignore_permissions=True)
