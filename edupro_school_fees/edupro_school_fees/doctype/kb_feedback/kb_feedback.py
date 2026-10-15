import frappe
from frappe.model.document import Document


class KBFeedback(Document):
	def validate(self):
		existing = frappe.db.exists(
			"KB Feedback", {"article_slug": self.article_slug, "user": self.user, "name": ["!=", self.name]}
		)
		if existing:
			frappe.throw(f"Feedback already exists for this user and article ({existing}).")
