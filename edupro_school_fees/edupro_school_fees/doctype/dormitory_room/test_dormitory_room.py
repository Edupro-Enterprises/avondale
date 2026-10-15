import frappe
from frappe.tests.utils import FrappeTestCase


class TestDormitoryRoom(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_requires_boarding_house(self):
		house = frappe.get_doc({"doctype": "Boarding House", "house_name": "Chaminuka Test House"}).insert()
		room = frappe.get_doc({
			"doctype": "Dormitory Room", "room_number": "12", "boarding_house": house.name,
		}).insert()
		self.assertEqual(room.name, f"{house.name}-12")
