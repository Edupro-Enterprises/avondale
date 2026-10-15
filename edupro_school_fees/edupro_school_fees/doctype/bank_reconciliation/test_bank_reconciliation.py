import frappe
from frappe.tests.utils import FrappeTestCase


class TestBankReconciliation(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("Bursar", "School Head") if r not in existing]
		if missing:
			for role in missing:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)

	def _make_bank_account(self, suffix):
		name = f"Bank Rec Test Bank {suffix}"
		if not frappe.db.exists("Account", name):
			frappe.get_doc({
				"doctype": "Account", "account_name": name, "account_type": "Asset", "currency": "ZiG",
			}).insert()
		return name

	def _post_je(self, bank_account, credit_account, amount, posting_date):
		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": posting_date,
			"entries": [
				{"account": bank_account, "debit": amount, "credit": 0},
				{"account": credit_account, "debit": 0, "credit": amount},
			],
		}).insert()
		je.submit()
		return je

	def test_balance_per_cashbook_computed_from_journal_entries(self):
		bank = self._make_bank_account("A")
		income = "Bank Rec Test Income A"
		frappe.get_doc({"doctype": "Account", "account_name": income, "account_type": "Income", "currency": "ZiG"}).insert()
		self._post_je(bank, income, 500, "2026-03-01")
		self._post_je(bank, income, 200, "2026-03-15")

		rec = frappe.get_doc({
			"doctype": "Bank Reconciliation",
			"bank_account": bank,
			"period_end": "2026-03-31",
			"balance_per_statement": 700,
		}).insert()

		self.assertEqual(rec.balance_per_cashbook, 700)
		self.assertEqual(rec.variance, 0)

	def test_cannot_mark_reconciled_with_outstanding_variance(self):
		bank = self._make_bank_account("B")
		income = "Bank Rec Test Income B"
		frappe.get_doc({"doctype": "Account", "account_name": income, "account_type": "Income", "currency": "ZiG"}).insert()
		self._post_je(bank, income, 500, "2026-03-01")

		rec = frappe.get_doc({
			"doctype": "Bank Reconciliation",
			"bank_account": bank,
			"period_end": "2026-03-31",
			"balance_per_statement": 800,
		}).insert()

		rec.workflow_state = "Pending Head Sign-Off"
		rec.save()
		rec.workflow_state = "Reconciled"
		with self.assertRaises(frappe.ValidationError):
			rec.save()

	def test_adjustments_can_zero_out_variance_and_allow_reconciled(self):
		bank = self._make_bank_account("C")
		income = "Bank Rec Test Income C"
		frappe.get_doc({"doctype": "Account", "account_name": income, "account_type": "Income", "currency": "ZiG"}).insert()
		self._post_je(bank, income, 500, "2026-03-01")

		rec = frappe.get_doc({
			"doctype": "Bank Reconciliation",
			"bank_account": bank,
			"period_end": "2026-03-31",
			"balance_per_statement": 550,
			"adjustments": [
				{"adjustment_type": "Deposit in Transit", "description": "Late deposit", "amount": 50},
			],
		}).insert()

		self.assertEqual(rec.reconciled_balance, 550)
		self.assertEqual(rec.variance, 0)

		rec.workflow_state = "Pending Head Sign-Off"
		rec.save()
		rec.workflow_state = "Reconciled"
		rec.save()
		self.assertEqual(rec.workflow_state, "Reconciled")

	def test_flag_discrepancy_sends_back_to_bursar(self):
		bank = self._make_bank_account("D")
		income = "Bank Rec Test Income D"
		frappe.get_doc({"doctype": "Account", "account_name": income, "account_type": "Income", "currency": "ZiG"}).insert()
		self._post_je(bank, income, 500, "2026-03-01")

		rec = frappe.get_doc({
			"doctype": "Bank Reconciliation",
			"bank_account": bank,
			"period_end": "2026-03-31",
			"balance_per_statement": 800,
		}).insert()

		rec.workflow_state = "Pending Head Sign-Off"
		rec.save()
		rec.workflow_state = "Discrepancy Flagged"
		rec.save()
		self.assertEqual(rec.workflow_state, "Discrepancy Flagged")
