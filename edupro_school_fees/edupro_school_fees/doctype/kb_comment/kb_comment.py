import frappe
from frappe.model.document import Document

MAX_BODY_LENGTH = 2000


class KBComment(Document):
	def validate(self):
		self.body = (self.body or "").strip()
		if not self.body:
			frappe.throw("A comment cannot be empty.")
		if len(self.body) > MAX_BODY_LENGTH:
			frappe.throw(f"A comment cannot be longer than {MAX_BODY_LENGTH} characters.")
