"""Petty Cash Float/Voucher/Replenishment: the imprest cycle -- a float starts full,
vouchers deplete it (blocked once insufficient), and only a Replenishment actually
journal-posts (Dr each voucher's own expense account, Cr the bank account), restoring
the float and marking those vouchers Reimbursed.
"""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestPettyCash(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		user = frappe.get_doc("User", "Administrator")
		if not any(r.role == "School Head" for r in user.roles):
			user.append("roles", {"role": "School Head"})
			user.save(ignore_permissions=True)

	def _make_budget_line(self, suffix, approved_budget=100000):
		academic_year = f"2026 Petty Cash Year {suffix}"
		frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": academic_year,
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()

		expense_account = f"Petty Cash Test Expense {suffix}"
		frappe.get_doc({
			"doctype": "Account", "account_name": expense_account, "account_type": "Expense", "currency": "ZiG",
		}).insert()

		budget_line = frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book.name,
			"vote_code": f"VOTE-{suffix}",
			"description": f"Petty cash test vote {suffix}",
			"fund": "Fund A - General/Government",
			"expense_account": expense_account,
			"approved_budget": approved_budget,
		}).insert()
		return budget_line.name

	def _make_float(self, suffix, float_amount=500):
		bank = f"Petty Cash Test Bank {suffix}"
		if not frappe.db.exists("Account", bank):
			frappe.get_doc({
				"doctype": "Account", "account_name": bank, "account_type": "Asset", "currency": "ZiG",
			}).insert()
		float_account = f"Petty Cash Test Till {suffix}"
		if not frappe.db.exists("Account", float_account):
			frappe.get_doc({
				"doctype": "Account", "account_name": float_account, "account_type": "Asset", "currency": "ZiG",
			}).insert()
		payment_method = f"Petty Cash Test Bank Method {suffix}"
		if not frappe.db.exists("Payment Method", payment_method):
			frappe.get_doc({
				"doctype": "Payment Method", "method_name": payment_method, "account": bank, "currency": "ZiG",
			}).insert()

		float_doc = frappe.get_doc({
			"doctype": "Petty Cash Float",
			"float_name": f"Test Float {suffix}",
			"custodian": "Administrator",
			"account": float_account,
			"float_amount": float_amount,
		}).insert()
		return float_doc.name, payment_method

	def test_float_starts_at_full_balance(self):
		float_name, _ = self._make_float("A", float_amount=500)
		self.assertEqual(frappe.db.get_value("Petty Cash Float", float_name, "balance"), 500)

	def test_voucher_deducts_from_float_on_submit(self):
		float_name, _ = self._make_float("B", float_amount=500)
		budget_line = self._make_budget_line("B")

		voucher = frappe.get_doc({
			"doctype": "Petty Cash Voucher",
			"petty_cash_float": float_name,
			"posting_date": "2026-03-01",
			"description": "Stationery",
			"amount": 120,
			"budget_line": budget_line,
		}).insert()
		voucher.submit()

		self.assertEqual(frappe.db.get_value("Petty Cash Float", float_name, "balance"), 380)

	def test_voucher_blocked_when_insufficient_balance(self):
		float_name, _ = self._make_float("C", float_amount=100)
		budget_line = self._make_budget_line("C")

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Petty Cash Voucher",
				"petty_cash_float": float_name,
				"posting_date": "2026-03-01",
				"description": "Too much",
				"amount": 150,
				"budget_line": budget_line,
			}).insert()

	def test_voucher_blocked_when_budget_line_fully_committed(self):
		# DEF-012: Purchase Order already checked available_balance before
		# committing a Budget Line; Petty Cash Voucher never did, so a fully
		# committed vote could still be silently overspent through petty cash.
		float_name, _ = self._make_float("Z", float_amount=500)
		budget_line = self._make_budget_line("Z", approved_budget=100)
		frappe.get_doc("Budget Line", budget_line).adjust(committed_delta=100)
		self.assertEqual(frappe.db.get_value("Budget Line", budget_line, "available_balance"), 0)

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Petty Cash Voucher",
				"petty_cash_float": float_name,
				"posting_date": "2026-03-01",
				"description": "Over budget",
				"amount": 10,
				"budget_line": budget_line,
			}).insert()

	def test_replenishment_reimburses_vouchers_and_posts_journal_entry(self):
		float_name, payment_method = self._make_float("D", float_amount=500)
		budget_line_name = self._make_budget_line("D")

		voucher = frappe.get_doc({
			"doctype": "Petty Cash Voucher",
			"petty_cash_float": float_name,
			"posting_date": "2026-03-01",
			"description": "Tea and sugar",
			"amount": 80,
			"budget_line": budget_line_name,
		}).insert()
		voucher.submit()

		replenishment = frappe.get_doc({
			"doctype": "Petty Cash Replenishment",
			"petty_cash_float": float_name,
			"posting_date": "2026-03-10",
			"payment_method": payment_method,
		}).insert()
		self.assertEqual(replenishment.amount, 80)
		replenishment.submit()

		voucher.reload()
		self.assertEqual(voucher.status, "Reimbursed")

		self.assertEqual(frappe.db.get_value("Petty Cash Float", float_name, "balance"), 500)

		budget_line = frappe.get_doc("Budget Line", budget_line_name)
		self.assertEqual(budget_line.actual_spend, 80)

		je_name = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Petty Cash Replenishment", "reference_name": replenishment.name}, "name"
		)
		self.assertTrue(je_name)
		je = frappe.get_doc("Journal Entry", je_name)
		self.assertEqual(je.total_debit, 80)
		self.assertEqual(je.total_credit, 80)

	def test_replenishment_fund_tagged_when_single_fund_and_reconciles_clean(self):
		# DEF-020: a replenishment whose vouchers all sit on one fund's Budget
		# Lines must be fund-tagged (was always left unset before), so SDC's
		# own Receipts & Payments report doesn't silently drop real Fund B
		# spend. DEF-021: reconcile_budget_lines() must not show a false
		# discrepancy on a Budget Line that's had petty cash spent against it.
		from edupro_school_fees.reports import reconcile_budget_lines

		float_name, payment_method = self._make_float("G", float_amount=500)
		budget_line_name = self._make_budget_line("G")
		frappe.db.set_value("Budget Line", budget_line_name, "fund", "Fund B - SDC/SDA")

		voucher = frappe.get_doc({
			"doctype": "Petty Cash Voucher",
			"petty_cash_float": float_name,
			"posting_date": "2026-03-01",
			"description": "Stationery",
			"amount": 60,
			"budget_line": budget_line_name,
		}).insert()
		voucher.submit()

		replenishment = frappe.get_doc({
			"doctype": "Petty Cash Replenishment",
			"petty_cash_float": float_name,
			"posting_date": "2026-03-10",
			"payment_method": payment_method,
		}).insert()
		replenishment.submit()

		je_name = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Petty Cash Replenishment", "reference_name": replenishment.name}, "name",
		)
		self.assertEqual(frappe.db.get_value("Journal Entry", je_name, "fund"), "Fund B - SDC/SDA")

		result = reconcile_budget_lines()
		flagged = [d for d in result["discrepancies"] if d["budget_line"] == budget_line_name]
		self.assertEqual(flagged, [])

	def test_replenishment_blocked_with_no_pending_vouchers(self):
		float_name, payment_method = self._make_float("E", float_amount=500)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Petty Cash Replenishment",
				"petty_cash_float": float_name,
				"posting_date": "2026-03-10",
				"payment_method": payment_method,
			}).insert()

	def test_float_cannot_close_with_pending_vouchers(self):
		float_name, _ = self._make_float("F", float_amount=500)
		budget_line = self._make_budget_line("F")

		voucher = frappe.get_doc({
			"doctype": "Petty Cash Voucher",
			"petty_cash_float": float_name,
			"posting_date": "2026-03-01",
			"description": "Pending",
			"amount": 50,
			"budget_line": budget_line,
		}).insert()
		voucher.submit()

		float_doc = frappe.get_doc("Petty Cash Float", float_name)
		float_doc.status = "Closed"
		with self.assertRaises(frappe.ValidationError):
			float_doc.save()
