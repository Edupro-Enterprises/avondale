import frappe
from frappe.tests.utils import FrappeTestCase


class TestBusRoute(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_with_stops(self):
		route = frappe.get_doc({
			"doctype": "Bus Route",
			"route_name": "Route A Test",
			"stops": [{"stop_name": "Mbare Musika"}, {"stop_name": "Coppacabana"}],
		}).insert()
		self.assertEqual(len(route.stops), 2)
