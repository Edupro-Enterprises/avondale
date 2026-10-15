"""Unit tests for Academic Year: term auto-generation math, date validation, and the
single-current-year invariant."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestAcademicYear(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_auto_generates_exactly_three_terms(self):
		ay = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": "2027 Test Year",
			"start_date": "2027-01-01",
			"end_date": "2027-12-31",
		}).insert()

		terms = frappe.get_all("Term", filters={"academic_year": ay.name}, fields=["term_number", "start_date", "end_date"], order_by="term_number")
		self.assertEqual(len(terms), 3)
		self.assertEqual([t.term_number for t in terms], [1, 2, 3])
		# Term 3 must absorb any remainder days from integer-division of the year into thirds.
		self.assertEqual(str(terms[-1].end_date), "2027-12-31")
		self.assertEqual(str(terms[0].start_date), "2027-01-01")

	def test_end_date_before_start_date_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Academic Year",
				"academic_year_name": "2028 Invalid Year",
				"start_date": "2028-12-31",
				"end_date": "2028-01-01",
			}).insert()

	def test_only_one_current_academic_year(self):
		first = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": "2029 First",
			"start_date": "2029-01-01",
			"end_date": "2029-12-31",
			"is_current": 1,
		}).insert()

		second = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": "2030 Second",
			"start_date": "2030-01-01",
			"end_date": "2030-12-31",
			"is_current": 1,
		}).insert()

		first.reload()
		self.assertEqual(first.is_current, 0)
		self.assertEqual(second.is_current, 1)

	def test_cannot_delete_academic_year_with_terms(self):
		ay = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": "2031 Has Terms",
			"start_date": "2031-01-01",
			"end_date": "2031-12-31",
		}).insert()

		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Academic Year", ay.name)
