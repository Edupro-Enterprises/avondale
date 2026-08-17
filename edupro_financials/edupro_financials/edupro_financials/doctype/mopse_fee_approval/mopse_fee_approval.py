import frappe
from frappe import _
from frappe.model.document import Document


class MoPSEFeeApproval(Document):
	def validate(self):
		if self.approved_usd_fee <= 0:
			frappe.throw(_("Approved USD Fee must be greater than zero."))
