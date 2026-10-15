import frappe
from frappe.model.document import Document


def _pending_vouchers(petty_cash_float):
	return frappe.get_all(
		"Petty Cash Voucher",
		filters={"petty_cash_float": petty_cash_float, "status": "Pending Reimbursement", "docstatus": 1},
		fields=["name", "amount", "budget_line"],
	)


class PettyCashReplenishment(Document):
	def validate(self):
		pending = _pending_vouchers(self.petty_cash_float)
		if not pending:
			frappe.throw(f"{self.petty_cash_float} has no submitted vouchers awaiting reimbursement.")
		self.amount = sum(row.amount for row in pending)

	def on_submit(self):
		payment_account = frappe.db.get_value("Payment Method", self.payment_method, "account")
		if not payment_account:
			frappe.throw("Payment Method's account must be set before replenishment.")

		pending = _pending_vouchers(self.petty_cash_float)
		totals_by_expense_account = {}
		funds_touched = set()
		for row in pending:
			budget_line = frappe.get_doc("Budget Line", row.budget_line)
			totals_by_expense_account[budget_line.expense_account] = (
				totals_by_expense_account.get(budget_line.expense_account, 0) + row.amount
			)
			funds_touched.add(budget_line.fund)
			frappe.db.set_value("Petty Cash Voucher", row.name, "status", "Reimbursed")
			budget_line.adjust(actual_delta=row.amount)

		lines = [{"account": account, "debit": amount, "credit": 0} for account, amount in totals_by_expense_account.items()]
		lines.append({"account": payment_account, "debit": 0, "credit": self.amount})

		from edupro_school_fees.utils import create_journal_entry_for_petty_cash_replenishment

		# DEF-020: a replenishment that happens to only touch one fund's Budget
		# Lines should be fund-tagged like any other single-fund JE -- only a
		# genuinely mixed-fund replenishment stays unset (see _reference_fund()).
		single_fund = funds_touched.pop() if len(funds_touched) == 1 else None
		create_journal_entry_for_petty_cash_replenishment(self, lines, fund=single_fund)

		frappe.get_doc("Petty Cash Float", self.petty_cash_float).replenish(self.amount)
