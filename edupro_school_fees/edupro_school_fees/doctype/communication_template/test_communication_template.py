import frappe
from frappe.tests.utils import FrappeTestCase


class TestCommunicationTemplate(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_and_read(self):
		suffix = frappe.generate_hash(length=6)
		tpl = frappe.get_doc({
			"doctype": "Communication Template",
			"template_name": f"Second reminder {suffix}",
			"channel": "SMS",
			"body": "Dear guardian, {studentName} has an outstanding balance of {amount} ({ageingBucket}).",
		}).insert()
		self.assertEqual(tpl.channel, "SMS")

	def test_body_required(self):
		suffix = frappe.generate_hash(length=6)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Communication Template",
				"template_name": f"No body {suffix}",
				"channel": "SMS",
			}).insert()
