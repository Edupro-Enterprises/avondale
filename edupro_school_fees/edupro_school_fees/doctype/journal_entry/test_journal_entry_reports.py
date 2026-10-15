"""Phase 7 core financial statements (reports.py). Uses plain Journal Entries
(like test_bank_reconciliation.py's own _post_je helper) rather than the full
procurement/invoicing chains -- what's under test here is reports.py's own
aggregation, not the doctypes that produce the ledger rows it reads.
"""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.reports import get_comprehensive_income, get_financial_position, get_receipts_and_payments


class TestReports(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _account(self, name, account_type):
		if not frappe.db.exists("Account", name):
			frappe.get_doc({
				"doctype": "Account", "account_name": name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return name

	def _post_je(self, debit_account, credit_account, amount, posting_date, reference_doctype=None):
		# reference_name is a Dynamic Link (validated against a real document of
		# reference_doctype) -- these tests only care about reference_doctype for
		# grouping, so it's left unset rather than pointed at a fake name.
		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": posting_date,
			"reference_doctype": reference_doctype,
			"entries": [
				{"account": debit_account, "debit": amount, "credit": 0},
				{"account": credit_account, "debit": 0, "credit": amount},
			],
		}).insert()
		je.submit()
		return je

	def test_receipts_and_payments_nets_cash_account_movement(self):
		cash = self._account("Reports Test Cash A", "Asset")
		income = self._account("Reports Test Income A", "Income")
		expense = self._account("Reports Test Expense A", "Expense")
		frappe.get_doc({
			"doctype": "Payment Method", "method_name": "Reports Test Method A", "account": cash, "currency": "ZiG",
		}).insert()

		# A "Receipt"-labelled JE debits cash (money in); a "Cashbook Payment"-labelled
		# JE credits cash (money out) -- exactly how the real doctypes post.
		self._post_je(cash, income, 500, "2026-04-01", reference_doctype="Receipt")
		self._post_je(expense, cash, 120, "2026-04-05", reference_doctype="Cashbook Payment")

		result = get_receipts_and_payments("2026-04-01", "2026-04-30")
		self.assertEqual(result["total_receipts"], 500)
		self.assertEqual(result["total_payments"], 120)
		self.assertEqual(result["net_movement"], 380)

	def test_receipts_and_payments_ignores_non_cash_accounts(self):
		# A JE that never touches any Payment Method's account shouldn't appear
		# in a cash-basis statement at all, no matter its own reference_doctype.
		debtors = self._account("Reports Test Debtors A", "Asset")
		income = self._account("Reports Test Income B", "Income")
		self._post_je(debtors, income, 999, "2026-04-10", reference_doctype="Invoice")

		result = get_receipts_and_payments("2026-04-01", "2026-04-30")
		self.assertEqual(result["total_receipts"], 0)
		self.assertEqual(result["total_payments"], 0)

	def test_comprehensive_income_surplus(self):
		# Delta, not absolute total: this project has no throwaway test DB, so
		# a shared May-2026 window can carry real committed data from other
		# runs (this test used to hardcode == 1000/400/600 and broke the first
		# time something else posted here first).
		cash = self._account("Reports Test Cash B", "Asset")
		income = self._account("Reports Test Income C", "Income")
		expense = self._account("Reports Test Expense B", "Expense")

		before = get_comprehensive_income("2026-05-01", "2026-05-31")

		self._post_je(cash, income, 1000, "2026-05-01")
		self._post_je(expense, cash, 400, "2026-05-02")

		result = get_comprehensive_income("2026-05-01", "2026-05-31")
		self.assertEqual(result["total_income"] - before["total_income"], 1000)
		self.assertEqual(result["total_expense"] - before["total_expense"], 400)
		self.assertEqual(result["surplus_deficit"] - before["surplus_deficit"], 600)

	def test_comprehensive_income_excludes_out_of_period_entries(self):
		cash = self._account("Reports Test Cash C", "Asset")
		income = self._account("Reports Test Income D", "Income")
		self._post_je(cash, income, 250, "2026-01-01")

		result = get_comprehensive_income("2026-06-01", "2026-06-30")
		self.assertEqual(result["total_income"], 0)

	def test_financial_position_is_cumulative_not_period_bound(self):
		cash = self._account("Reports Test Cash D", "Asset")
		income = self._account("Reports Test Income E", "Income")
		self._post_je(cash, income, 700, "2026-01-15")

		# As-of a date well after the transaction: still counted (cumulative),
		# unlike the period-scoped statements above.
		result = get_financial_position("2026-12-31")
		self.assertGreaterEqual(result["total_assets"], 700)
		self.assertEqual(result["accumulated_funds"], result["total_assets"] - result["total_liabilities"])

	def test_report_generation_is_audit_logged(self):
		# DEF-025: BR-RPT-04 requires report generation to be logged -- this
		# used to be true for exactly one report (Audit Trail Export) out of
		# ~14. Spot-check one of the others.
		before = frappe.db.count("Audit Log", {"action": ["like", "Report generated: Statement of Financial Position%"]})
		get_financial_position("2026-12-31")
		after = frappe.db.count("Audit Log", {"action": ["like", "Report generated: Statement of Financial Position%"]})
		self.assertEqual(after, before + 1)

	def test_reports_blocked_for_portal_roles(self):
		parent_email = "reports-parent@rbac.test"
		if not frappe.db.exists("User", parent_email):
			user = frappe.get_doc({
				"doctype": "User", "email": parent_email, "first_name": "Reports", "send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", parent_email)
		if not any(r.role == "Parent/Guardian" for r in user.roles):
			user.append("roles", {"role": "Parent/Guardian"})
			user.save(ignore_permissions=True)

		frappe.set_user(parent_email)
		with self.assertRaises(frappe.PermissionError):
			get_comprehensive_income("2026-01-01", "2026-12-31")
		with self.assertRaises(frappe.PermissionError):
			get_financial_position("2026-12-31")
		with self.assertRaises(frappe.PermissionError):
			get_receipts_and_payments("2026-01-01", "2026-12-31")
