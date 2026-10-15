import frappe
from frappe.model.document import Document


class AuditLog(Document):
	def before_insert(self):
		self.device_ip = frappe.local.request_ip if getattr(frappe.local, "request_ip", None) else self.device_ip

	def on_trash(self):
		# Append-only: the audit trail itself must never be edited or deleted.
		frappe.throw("Audit Log entries are append-only and cannot be deleted.")

	def on_update(self):
		# on_update fires on every save, including the very first insert -- and by
		# the time it runs, is_new() has already flipped to False (a documented
		# Frappe lifecycle quirk: the doc is in the DB by the time post-save hooks
		# run). self.flags.in_insert is the reliable way to distinguish "this save
		# IS the insert" from "this is a genuine later edit".
		if not self.flags.in_insert:
			frappe.throw("Audit Log entries are append-only and cannot be edited.")
