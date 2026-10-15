"""Grade Group/Class Stream/Boarding House/Dormitory Room/Bus Route were
named spec entities with no implementing doctype at all -- the frontend's
School Setup pages for them stayed mock-only until this."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestGradeGroup(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create(self):
		group = frappe.get_doc({"doctype": "Grade Group", "grade_group_name": "Junior Test"}).insert()
		self.assertEqual(group.name, "Junior Test")
