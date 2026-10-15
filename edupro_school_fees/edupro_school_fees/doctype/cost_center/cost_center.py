import frappe
from frappe.model.document import Document


class CostCenter(Document):
	def validate(self):
		if self.parent_cost_center == self.name:
			frappe.throw("A Cost Center cannot be its own parent.")
