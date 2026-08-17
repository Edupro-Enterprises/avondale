import frappe
from frappe import _
from frappe.model.document import Document


class StudentExemptionandDiscount(Document):
	def validate(self):
		if not self.supporting_document:
			frappe.throw(_("A supporting document is mandatory for every exemption or discount."))
		if not self.discount_percentage and not self.amount_covered:
			frappe.throw(_("Enter either a Discount Percentage or an Amount Covered."))
