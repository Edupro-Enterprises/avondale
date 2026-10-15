import frappe
from frappe.tests.utils import FrappeTestCase


class TestBoardingHouse(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create(self):
		house = frappe.get_doc({"doctype": "Boarding House", "house_name": "Nehanda Test House"}).insert()
		self.assertEqual(house.name, "Nehanda Test House")
