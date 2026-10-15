"""DEF-018: Cost Center/department was a named spec entity (Data Model
CostCenter) with no implementing doctype at all."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestCostCenter(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_and_link_to_account(self):
		cost_center = frappe.get_doc({
			"doctype": "Cost Center", "cost_center_name": "Boarding Test", "description": "Boarding department",
		}).insert()

		account = frappe.get_doc({
			"doctype": "Account", "account_name": "Cost Center Test Expense", "account_type": "Expense",
			"currency": "ZiG", "cost_center": cost_center.name,
		}).insert()
		self.assertEqual(account.cost_center, cost_center.name)

	def test_cannot_be_own_parent(self):
		cost_center = frappe.get_doc({"doctype": "Cost Center", "cost_center_name": "Sports Test"}).insert()
		cost_center.parent_cost_center = cost_center.name
		with self.assertRaises(frappe.ValidationError):
			cost_center.save()
