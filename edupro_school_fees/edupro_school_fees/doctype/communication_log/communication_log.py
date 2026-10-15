import frappe
from frappe.model.document import Document


class CommunicationLog(Document):
	def validate(self):
		if not self.parent_guardian and not self.applicant:
			frappe.throw("A Communication Log entry needs either a Parent Guardian or an Applicant.")
