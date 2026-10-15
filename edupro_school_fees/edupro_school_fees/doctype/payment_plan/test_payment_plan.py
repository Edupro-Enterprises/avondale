import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, nowdate

from edupro_school_fees.utils import check_payment_plan_installments


class TestPaymentPlan(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make_case(self, suffix):
		academic_year = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": f"PP Test Year {suffix}",
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()

		category = frappe.get_doc({
			"doctype": "Beneficiary Category",
			"category_name": f"PP Test Category {suffix}",
		}).insert()

		student = frappe.get_doc({
			"doctype": "Student",
			"first_name": "PP",
			"last_name": f"Test {suffix}",
			"admission_date": "2026-01-05",
			"academic_year": academic_year.name,
			"beneficiary_category": category.name,
		}).insert()

		return frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

	def test_check_payment_plan_installments_flips_overdue_and_defaults_plan(self):
		case = self._make_case("A")
		plan = frappe.get_doc({
			"doctype": "Payment Plan",
			"debtor_case": case.name,
			"student": case.student,
			"total_amount": 100,
			"start_date": nowdate(),
			"installments": [
				{"due_date": add_days(nowdate(), -5), "amount": 50},
				{"due_date": add_days(nowdate(), 30), "amount": 50},
			],
		}).insert()
		self.assertEqual(plan.status, "Active")

		check_payment_plan_installments()

		plan.reload()
		self.assertEqual(plan.installments[0].status, "Overdue")
		self.assertEqual(plan.installments[1].status, "Pending")
		self.assertEqual(plan.status, "Defaulted")

	def test_check_payment_plan_installments_leaves_on_time_plans_active(self):
		case = self._make_case("B")
		plan = frappe.get_doc({
			"doctype": "Payment Plan",
			"debtor_case": case.name,
			"student": case.student,
			"total_amount": 100,
			"start_date": nowdate(),
			"installments": [{"due_date": add_days(nowdate(), 30), "amount": 100}],
		}).insert()

		check_payment_plan_installments()

		plan.reload()
		self.assertEqual(plan.status, "Active")
		self.assertEqual(plan.installments[0].status, "Pending")

	def test_plan_completed_when_all_installments_paid(self):
		case = self._make_case("C")
		plan = frappe.get_doc({
			"doctype": "Payment Plan",
			"debtor_case": case.name,
			"student": case.student,
			"total_amount": 100,
			"start_date": nowdate(),
			"installments": [{"due_date": add_days(nowdate(), 30), "amount": 100, "status": "Paid"}],
		}).insert()

		self.assertEqual(plan.status, "Completed")
