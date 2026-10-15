"""Exchange Rate DocType tests, plus utils.py's get_exchange_rate()/convert_amount()
which have no other natural home in this app's per-doctype test layout."""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.utils import _to_base_currency, convert_amount, get_exchange_rate


class TestExchangeRate(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make(self, effective_date, rate=350.0, is_active=1, from_currency="USD", to_currency="ZiG"):
		return frappe.get_doc({
			"doctype": "Exchange Rate",
			"from_currency": from_currency,
			"to_currency": to_currency,
			"exchange_rate": rate,
			"effective_date": effective_date,
			"source": "Manual",
			"is_active": is_active,
		}).insert()

	def test_same_currency_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._make("2027-01-01", from_currency="ZiG", to_currency="ZiG")

	def test_duplicate_active_rate_same_pair_and_date_rejected(self):
		self._make("2027-02-01")
		with self.assertRaises(frappe.ValidationError):
			self._make("2027-02-01", rate=360.0)

	def test_inactive_duplicate_allowed(self):
		self._make("2027-03-01", is_active=0)
		self._make("2027-03-01", is_active=1)

	def test_rate_locked_after_save(self):
		fx = self._make("2027-04-01")
		fx.exchange_rate = 999
		with self.assertRaises(frappe.ValidationError):
			fx.save()

	def test_effective_date_locked_after_save(self):
		fx = self._make("2027-05-01")
		fx.effective_date = "2027-05-02"
		with self.assertRaises(frappe.ValidationError):
			fx.save()

	def test_remarks_editable_after_save(self):
		fx = self._make("2027-06-01")
		fx.remarks = "Corrected source note"
		fx.save()
		self.assertEqual(fx.remarks, "Corrected source note")

	def test_get_exchange_rate_same_currency_needs_no_record(self):
		self.assertEqual(get_exchange_rate("ZiG", "ZiG"), 1.0)

	def test_get_exchange_rate_direct_and_as_of_date(self):
		self._make("2027-07-01", rate=300.0)
		self._make("2027-07-15", rate=320.0)
		self.assertEqual(get_exchange_rate("USD", "ZiG", as_of_date="2027-07-10"), 300.0)
		self.assertEqual(get_exchange_rate("USD", "ZiG", as_of_date="2027-07-20"), 320.0)

	def test_get_exchange_rate_falls_back_to_inverse(self):
		self._make("2027-08-01", rate=400.0, from_currency="USD", to_currency="ZiG")
		self.assertEqual(get_exchange_rate("ZiG", "USD", as_of_date="2027-08-05"), 1 / 400.0)

	def test_get_exchange_rate_throws_when_missing(self):
		with self.assertRaises(frappe.ValidationError):
			get_exchange_rate("USD", "ZiG", as_of_date="2020-01-01")

	def test_convert_amount_uses_given_rate_without_lookup(self):
		self.assertEqual(convert_amount(100, "USD", "ZiG", rate=350), 35000)

	def test_convert_amount_same_currency_is_identity(self):
		self.assertEqual(convert_amount(100, "ZiG", "ZiG"), 100)

	# _to_base_currency is the fix for F-01 (see create_journal_entry_for_receipt/
	# _invoice in utils.py) -- a Journal Entry line's amount must be converted
	# into BASE_CURRENCY (ZiG) before it's stored, since debit==credit is
	# checked as a single-currency sum, not per-account-currency.

	def test_to_base_currency_zig_is_a_no_op(self):
		self.assertEqual(_to_base_currency(100, "ZiG"), 100)

	def test_to_base_currency_converts_usd_to_zig(self):
		self._make("2027-09-01", rate=27.0)
		self.assertEqual(_to_base_currency(40.50, "USD", as_of_date="2027-09-05"), 1093.50)

	def test_to_base_currency_uses_the_rate_in_force_on_the_given_date(self):
		self._make("2027-10-01", rate=27.0)
		self._make("2027-10-15", rate=30.0)
		self.assertEqual(_to_base_currency(10, "USD", as_of_date="2027-10-10"), 270)
		self.assertEqual(_to_base_currency(10, "USD", as_of_date="2027-10-20"), 300)
