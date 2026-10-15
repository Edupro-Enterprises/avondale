import frappe
from frappe.model.document import Document


class PettyCashVoucher(Document):
	def validate(self):
		float_doc = frappe.get_doc("Petty Cash Float", self.petty_cash_float)
		if float_doc.status != "Active":
			frappe.throw(f"{float_doc.name} is not Active.")
		if self.is_new() and (float_doc.balance or 0) < self.amount:
			frappe.throw(
				f"{float_doc.name} has insufficient balance ({float_doc.balance} available, "
				f"{self.amount} required) -- replenish before issuing further vouchers."
			)

		# Purchase Order already checks this before committing a Budget Line
		# (see PurchaseOrder.validate()) -- petty cash was the one spending path
		# that never did, so a vote already fully committed via POs could still
		# be silently overspent through petty cash with nothing to catch it.
		if self.is_new() and self.budget_line:
			budget_line = frappe.get_doc("Budget Line", self.budget_line)
			if budget_line.available_balance < self.amount:
				frappe.throw(
					f"Budget Vote Book: insufficient available balance on {budget_line.vote_code} "
					f"({budget_line.available_balance} available, {self.amount} required)."
				)

	def on_submit(self):
		frappe.get_doc("Petty Cash Float", self.petty_cash_float).deduct(self.amount)
