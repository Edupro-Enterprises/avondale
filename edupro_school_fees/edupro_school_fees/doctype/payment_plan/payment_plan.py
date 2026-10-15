import frappe
from frappe.model.document import Document


class PaymentPlan(Document):
	def validate(self):
		self._validate_installments_total()
		self._refresh_status()

	def after_insert(self):
		# Creating a Payment Plan is what "Payment Plan Active" means -- move the
		# case out of Open automatically rather than relying on the Bursar to
		# remember a second manual transition.
		case = frappe.get_doc("Debtor Case", self.debtor_case)
		if case.workflow_state == "Open":
			case.workflow_state = "Payment Plan Active"
			case.save(ignore_permissions=True)

	def _validate_installments_total(self):
		installments_total = sum(row.amount or 0 for row in self.installments)
		if installments_total != self.total_amount:
			frappe.throw(
				f"Installments total {installments_total} does not match "
				f"Total Amount {self.total_amount}."
			)

	def _refresh_status(self):
		if self.status in ("Cancelled", "Defaulted"):
			return
		if self.installments and all(row.status == "Paid" for row in self.installments):
			self.status = "Completed"
