import frappe
from frappe.tests.utils import FrappeTestCase


class TestBudgetLine(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		user = frappe.get_doc("User", "Administrator")
		if not any(r.role == "School Head" for r in user.roles):
			user.append("roles", {"role": "School Head"})
			user.save(ignore_permissions=True)

	def _make_expense_account(self, suffix):
		name = f"Budget Line Test Expense {suffix}"
		if not frappe.db.exists("Account", name):
			frappe.get_doc({
				"doctype": "Account", "account_name": name, "account_type": "Expense", "currency": "ZiG",
			}).insert()
		return name

	def test_new_budget_line_blocked_on_closed_vote_book(self):
		academic_year = "2026 Budget Line Test Year"
		frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": academic_year,
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()
		vote_book.workflow_state = "Active"
		vote_book.save()
		vote_book.workflow_state = "Closed"
		vote_book.save()

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Budget Line",
				"budget_vote_book": vote_book.name,
				"vote_code": "VOTE-CLOSED",
				"description": "Should be rejected",
				"fund": "Fund A - General/Government",
				"expense_account": self._make_expense_account("closed"),
				"approved_budget": 1000,
			}).insert()

	def test_available_balance_defaults_to_approved_budget(self):
		academic_year = "2026 Budget Line Default Year"
		frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": academic_year,
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()

		budget_line = frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book.name,
			"vote_code": "VOTE-DEFAULT",
			"description": "Fresh vote",
			"fund": "Fund A - General/Government",
			"expense_account": self._make_expense_account("default"),
			"approved_budget": 5000,
		}).insert()

		self.assertEqual(budget_line.available_balance, 5000)
		self.assertEqual(budget_line.committed_amount, 0)
		self.assertEqual(budget_line.actual_spend, 0)

	def _make_user(self, email, role):
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0],
				"send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", email)
		if not any(r.role == role for r in user.roles):
			user.append("roles", {"role": role})
			user.save(ignore_permissions=True)
		return email

	def test_sdc_sees_only_fund_b_budget_lines(self):
		academic_year = "2026 Budget Line SDC Year"
		frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": academic_year,
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()

		fund_a = frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book.name,
			"vote_code": "VOTE-SDC-A",
			"description": "Fund A vote",
			"fund": "Fund A - General/Government",
			"expense_account": self._make_expense_account("sdc-a"),
			"approved_budget": 1000,
		}).insert()
		fund_b = frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book.name,
			"vote_code": "VOTE-SDC-B",
			"description": "Fund B vote",
			"fund": "Fund B - SDC/SDA",
			"expense_account": self._make_expense_account("sdc-b"),
			"approved_budget": 1000,
		}).insert()

		sdc = self._make_user("bl-sdc@rbac.test", "SDC Chairperson/Treasurer")
		frappe.set_user(sdc)
		names = frappe.get_list("Budget Line", pluck="name")
		self.assertIn(fund_b.name, names)
		self.assertNotIn(fund_a.name, names)

	def test_adjust_moves_between_committed_and_actual(self):
		academic_year = "2026 Budget Line Adjust Year"
		frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": academic_year,
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()

		budget_line = frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book.name,
			"vote_code": "VOTE-ADJUST",
			"description": "Adjust test",
			"fund": "Fund A - General/Government",
			"expense_account": self._make_expense_account("adjust"),
			"approved_budget": 1000,
		}).insert()

		budget_line.adjust(committed_delta=300)
		budget_line.reload()
		self.assertEqual(budget_line.committed_amount, 300)
		self.assertEqual(budget_line.available_balance, 700)

		budget_line.adjust(committed_delta=-300, actual_delta=300)
		budget_line.reload()
		self.assertEqual(budget_line.committed_amount, 0)
		self.assertEqual(budget_line.actual_spend, 300)
		self.assertEqual(budget_line.available_balance, 700)
