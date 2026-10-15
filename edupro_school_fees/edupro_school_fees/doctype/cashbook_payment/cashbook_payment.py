import frappe
from frappe.model.document import Document


class CashbookPayment(Document):
	def validate(self):
		voucher = frappe.get_doc("Payment Voucher", self.payment_voucher)
		if voucher.workflow_state != "Approved":
			frappe.throw(f"{voucher.name} is not Approved -- cannot disburse.")
		if voucher.disbursed:
			frappe.throw(f"{voucher.name} has already been disbursed.")

		# Explicit copy rather than fetch_from -- this is a money-movement record, and
		# the amount actually disbursed must be pinned to what the Payment Voucher held
		# at approval time, not whatever the field-fetch mechanism happens to resolve.
		self.fund = voucher.fund
		self.budget_line = voucher.budget_line
		self.amount = voucher.amount
		self.currency = voucher.currency
		self.payment_method = voucher.payment_method

	def on_submit(self):
		budget_line = frappe.get_doc("Budget Line", self.budget_line)
		payment_account = frappe.db.get_value("Payment Method", self.payment_method, "account")
		if not budget_line.expense_account or not payment_account:
			frappe.throw("Budget Line's expense account and Payment Method's account must both be set before disbursement.")

		from edupro_school_fees.utils import create_journal_entry_for_cashbook_payment

		create_journal_entry_for_cashbook_payment(self, budget_line.expense_account, payment_account)

		budget_line.adjust(committed_delta=-self.amount, actual_delta=self.amount)
		frappe.db.set_value("Payment Voucher", self.payment_voucher, "disbursed", 1)
