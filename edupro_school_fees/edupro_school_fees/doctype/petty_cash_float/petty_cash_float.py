import frappe
from frappe.model.document import Document
from frappe.utils import flt


class PettyCashFloat(Document):
	def validate(self):
		if self.is_new() and not self.balance:
			self.balance = self.float_amount

		if self.has_value_changed("status") and self.status == "Closed":
			pending = frappe.db.count(
				"Petty Cash Voucher",
				{"petty_cash_float": self.name, "status": "Pending Reimbursement", "docstatus": 1},
			)
			if pending:
				frappe.throw(f"{self.name} has {pending} voucher(s) still awaiting reimbursement -- replenish before closing.")

	def deduct(self, amount):
		frappe.db.set_value("Petty Cash Float", self.name, "balance", flt((self.balance or 0) - amount, 2))

	def replenish(self, amount):
		frappe.db.set_value("Petty Cash Float", self.name, "balance", flt((self.balance or 0) + amount, 2))
