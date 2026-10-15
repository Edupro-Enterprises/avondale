"""DEF-006: Fee Item must be able to declare its own currency, defaulting to
ZiG so existing (pre-migration) Fee Items keep working unchanged."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestFeeItem(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return account_name

	def test_currency_defaults_to_zig(self):
		income = self._ensure_account("Fee Item Test Income", "Income")
		item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "Fee Item Test Default", "default_amount": 100, "account": income,
		}).insert()
		self.assertEqual(item.currency, "ZiG")

	def test_currency_can_be_set_to_usd(self):
		income = self._ensure_account("Fee Item Test Income USD", "Income")
		item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "Fee Item Test USD", "default_amount": 25,
			"account": income, "currency": "USD",
		}).insert()
		self.assertEqual(item.currency, "USD")

	def test_invoice_line_fetches_currency_from_fee_item(self):
		income = self._ensure_account("Fee Item Test Income Fetch", "Income")
		item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "Fee Item Test Fetch", "default_amount": 25,
			"account": income, "currency": "USD",
		}).insert()

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "2026 Fee Item Currency Test",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "Fee Item Currency Test Cat"}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": "Fee Item Currency Test Structure",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": category.name,
			"items": [{"fee_item": item.name, "amount": 25}],
		}).insert()

		self.assertEqual(fee_structure.items[0].currency, "USD")
