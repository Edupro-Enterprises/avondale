import frappe
from frappe.model.document import Document


class KBReadingActivity(Document):
	def validate(self):
		# One row per (user, article) -- enforced here rather than a composite
		# DB unique key, matching this app's established style (see
		# Communication Log's validate()) of explicit Python checks over
		# schema-level constraints.
		existing = frappe.db.exists(
			"KB Reading Activity", {"article_slug": self.article_slug, "user": self.user, "name": ["!=", self.name]}
		)
		if existing:
			frappe.throw(f"A KB Reading Activity row already exists for this user and article ({existing}).")
