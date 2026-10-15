"""Unit tests for School Setup: banking-configuration validation, the single-instance
constraint, and the Phase 2.1 Chart-of-Accounts generation fix."""

import frappe
from frappe.tests.utils import FrappeTestCase


def _valid_banking_rows():
	return [
		{"bank_name": "Test Bank", "account_name": "Tuition ZiG", "account_number": "T-001", "currency_type": "ZiG", "fee_stream": "Tuition", "is_active": 1},
		{"bank_name": "Test Bank", "account_name": "Tuition FCA", "account_number": "T-002", "currency_type": "FCA", "fee_stream": "Tuition", "is_active": 1},
		{"bank_name": "Test Bank", "account_name": "Levy ZiG", "account_number": "T-003", "currency_type": "ZiG", "fee_stream": "Levy/SDC", "is_active": 1},
		{"bank_name": "Test Bank", "account_name": "Levy FCA", "account_number": "T-004", "currency_type": "FCA", "fee_stream": "Levy/SDC", "is_active": 1},
	]


class TestSchoolSetup(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		# School Setup enforces a hard single-instance constraint; each test that needs
		# a fresh singleton must clear any leftover row from a prior, non-rolled-back run.
		for name in frappe.get_all("School Setup", pluck="name"):
			frappe.delete_doc("School Setup", name, force=True, ignore_permissions=True)

	def test_missing_tuition_account_rejected(self):
		rows = [r for r in _valid_banking_rows() if r["fee_stream"] != "Tuition"]
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "School Setup",
				"school_name": "Test School",
				"registration_number": "REG-001",
				"emis_number": "EMIS-001",
				"school_code": "TST",
				"physical_address": "1 Test Street",
				"banking_configuration": rows,
			}).insert()

	def test_missing_currency_for_stream_rejected(self):
		rows = [r for r in _valid_banking_rows() if not (r["fee_stream"] == "Tuition" and r["currency_type"] == "FCA")]
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "School Setup",
				"school_name": "Test School",
				"registration_number": "REG-001",
				"emis_number": "EMIS-001",
				"school_code": "TST",
				"physical_address": "1 Test Street",
				"banking_configuration": rows,
			}).insert()

	def test_valid_setup_generates_chart_of_accounts(self):
		frappe.get_doc({
			"doctype": "School Setup",
			"school_name": "Test School",
			"registration_number": "REG-001",
			"emis_number": "EMIS-001",
			"school_code": "TST",
			"physical_address": "1 Test Street",
			"banking_configuration": _valid_banking_rows(),
		}).insert()

		self.assertTrue(frappe.db.exists("Account", {"account_name": "Debtors", "account_type": "Asset"}))
		self.assertTrue(frappe.db.exists("Account", {"account_name": "Fees Income", "account_type": "Income"}))
		self.assertGreater(frappe.db.count("Account"), 1)

		# DEF-005: Fund B (SDC) must get a real bank/cash/expense structure of
		# its own, not just two Income leaves -- otherwise there is no way to
		# record an SDC disbursement without first manually creating accounts.
		fund_b = "Fund B - SDC/SDA"
		self.assertTrue(frappe.db.exists("Account", {"account_name": "Bank - SDC", "account_type": "Asset", "fund": fund_b}))
		self.assertTrue(frappe.db.exists("Account", {"account_name": "SDC Cash-in-Till", "account_type": "Asset", "fund": fund_b}))
		self.assertTrue(frappe.db.exists("Account", {"account_type": "Expense", "fund": fund_b}))

	def test_banking_row_with_account_creates_matching_payment_method(self):
		# DEF-004: a banking-config row with its Ledger Account filled in must
		# produce a real Payment Method the receipting engine can actually use
		# -- otherwise the wizard's data is disconnected from what receipts
		# post against.
		if not frappe.db.exists("Account", "DEF004 Tuition Bank"):
			frappe.get_doc({
				"doctype": "Account", "account_name": "DEF004 Tuition Bank", "account_type": "Asset", "currency": "ZiG",
			}).insert()

		rows = _valid_banking_rows()
		rows[0]["account"] = "DEF004 Tuition Bank"
		frappe.get_doc({
			"doctype": "School Setup",
			"school_name": "Test School",
			"registration_number": "REG-001",
			"emis_number": "EMIS-001",
			"school_code": "TST",
			"physical_address": "1 Test Street",
			"banking_configuration": rows,
		}).insert()

		method_name = "Test Bank - Tuition (ZiG)"
		self.assertTrue(frappe.db.exists("Payment Method", method_name))
		self.assertEqual(frappe.db.get_value("Payment Method", method_name, "account"), "DEF004 Tuition Bank")

	def test_second_school_setup_rejected(self):
		frappe.get_doc({
			"doctype": "School Setup",
			"school_name": "Test School",
			"registration_number": "REG-001",
			"emis_number": "EMIS-001",
			"school_code": "TST",
			"physical_address": "1 Test Street",
			"banking_configuration": _valid_banking_rows(),
		}).insert()

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "School Setup",
				"school_name": "Second School",
				"registration_number": "REG-002",
				"emis_number": "EMIS-002",
				"school_code": "SEC",
				"physical_address": "2 Test Street",
				"banking_configuration": _valid_banking_rows(),
			}).insert()
