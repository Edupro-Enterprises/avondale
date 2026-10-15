import frappe
from frappe.tests.utils import FrappeTestCase


class TestClassStream(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_requires_grade_group(self):
		group = frappe.get_doc({"doctype": "Grade Group", "grade_group_name": "Senior Test"}).insert()
		stream = frappe.get_doc({
			"doctype": "Class Stream", "stream_name": "Form 4A Test", "grade_group": group.name,
		}).insert()
		self.assertEqual(stream.grade_group, group.name)
