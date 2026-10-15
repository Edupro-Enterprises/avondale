import frappe
from frappe.model.document import Document

from edupro_school_fees.utils import get_required_quote_count, get_sensitive_procurement_threshold


class PurchaseOrder(Document):
	def validate(self):
		requisition = frappe.get_doc("Requisition", self.requisition)
		if self.is_new() and requisition.status == "Closed":
			frappe.throw(f"{requisition.name} already has a Purchase Order issued against it.")

		required_quotes = get_required_quote_count(requisition.total_estimated_amount)
		if len(requisition.quotations) < required_quotes:
			frappe.throw(
				f"A Purchase Order needs at least {required_quotes} quotation(s) logged on its Requisition "
				f"for an estimated amount of {requisition.total_estimated_amount} (PRAZ procurement rule)."
			)
		selected = [row for row in requisition.quotations if row.is_selected]
		if len(selected) != 1:
			frappe.throw("Exactly one quotation on the Requisition must be marked Selected.")

		selected_vendor_status = frappe.db.get_value("Vendor", selected[0].vendor, "approval_status")
		if selected_vendor_status != "Approved":
			frappe.throw(
				f"{selected[0].vendor} is not an Approved vendor (status: {selected_vendor_status}). "
				"A School Head must approve a vendor before a Purchase Order can be issued to them."
			)

		self.vendor_name = selected[0].vendor_name
		self.amount = selected[0].quoted_amount
		self.currency = selected[0].currency
		self.is_sensitive_procurement = 1 if self.amount >= get_sensitive_procurement_threshold() else 0

		if self.is_new():
			budget_line = frappe.get_doc("Budget Line", requisition.budget_line)
			if budget_line.available_balance < self.amount:
				frappe.throw(
					f"Budget Vote Book: insufficient available balance on {budget_line.vote_code} "
					f"({budget_line.available_balance} available, {self.amount} required)."
				)
			# There is no separate draft-then-issue step anywhere in this app --
			# after_insert() below immediately closes the Requisition and commits
			# the Budget Line, so creation itself *is* issuance. status stays
			# "Issued" until Cancelled (on_update() below is the only other writer).
			self.status = "Issued"

	def after_insert(self):
		frappe.db.set_value("Requisition", self.requisition, "status", "Closed")
		frappe.get_doc("Budget Line", self.budget_line).adjust(committed_delta=self.amount)

	def on_update(self):
		if self.has_value_changed("status") and self.status == "Cancelled":
			frappe.get_doc("Budget Line", self.budget_line).adjust(committed_delta=-self.amount)

	def on_trash(self):
		# Confirmed real gap: deleting a PO (rather than cancelling it first)
		# skipped on_update entirely, leaving its committed_delta permanently
		# stuck against the Budget Line -- a phantom commitment with no
		# Purchase Order left to explain it. Already-Cancelled ones released
		# their commitment there, so releasing it again here would double-count.
		if self.status != "Cancelled":
			frappe.get_doc("Budget Line", self.budget_line).adjust(committed_delta=-self.amount)


@frappe.whitelist()
def get_required_quote_count_for_amount(amount):
	"""Read-only lookup so the frontend can show "you need N quotations for
	this amount" live while a Requisition is still being assembled, instead
	of the user only finding out once Purchase Order issuance is rejected."""
	return get_required_quote_count(amount)
