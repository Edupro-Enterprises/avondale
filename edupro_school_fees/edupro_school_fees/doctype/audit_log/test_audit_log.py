"""Unit tests for Audit Log immutability: the append-only trail must reject both
edits and deletes once a record exists."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestAuditLog(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make_entry(self):
		return frappe.get_doc({
			"doctype": "Audit Log",
			"user": "Administrator",
			"timestamp": frappe.utils.now_datetime(),
			"action": "Test Action",
			"reference_doctype": "Academic Year",
			"reference_name": "test-ref",
		}).insert()

	def test_cannot_edit_existing_entry(self):
		entry = self._make_entry()
		entry.reload()
		entry.action = "Tampered Action"
		with self.assertRaises(frappe.ValidationError):
			entry.save()

	def test_cannot_delete_entry(self):
		entry = self._make_entry()
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Audit Log", entry.name)

	def test_insert_itself_is_allowed(self):
		entry = self._make_entry()
		self.assertTrue(frappe.db.exists("Audit Log", entry.name))
