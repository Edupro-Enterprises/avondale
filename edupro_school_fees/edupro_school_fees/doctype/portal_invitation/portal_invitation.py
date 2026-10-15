import frappe
from frappe.model.document import Document

# Fields that must never change after creation -- everything about what was
# issued, to whom, and when it expires is fixed at issue time. Only
# used_at (set once, by redemption) and revoked_at/revoked_by (set once, by
# staff revocation) are ever allowed to move away from their initial value.
_IMMUTABLE_FIELDS = ("parent_guardian", "token_hash", "delivery_channel", "delivery_target", "expires_at")


class PortalInvitation(Document):
	def validate(self):
		# Must run in validate(), not on_update() -- on_update() fires after
		# db_update() has already written this save's new values, so a fresh
		# frappe.db.get_value() there would just compare the new value against
		# itself. validate() runs first, while the database still holds the
		# pre-save state (found by this doctype's own test suite: the guard
		# silently never fired when it lived in on_update()).
		if self.is_new():
			return

		previous = frappe.db.get_value(
			"Portal Invitation",
			self.name,
			[*_IMMUTABLE_FIELDS, "used_at"],
			as_dict=True,
		)
		if not previous:
			return

		for fieldname in _IMMUTABLE_FIELDS:
			if self.get(fieldname) != previous.get(fieldname):
				frappe.throw(
					f"{self.meta.get_label(fieldname)} cannot be changed once an invitation "
					"is created."
				)

		if previous.used_at and self.used_at != previous.used_at:
			frappe.throw("Used At cannot be changed once an invitation has been redeemed.")
