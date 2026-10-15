import frappe
from frappe.tests.utils import FrappeTestCase


class TestCommunicationLog(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make_guardian(self, suffix):
		return frappe.get_doc({
			"doctype": "Parent Guardian",
			"full_name": f"CL Test Guardian {suffix}",
			"phone_number": "0771234567",
		}).insert()

	def test_create_and_read(self):
		guardian = self._make_guardian("A")
		log = frappe.get_doc({
			"doctype": "Communication Log",
			"parent_guardian": guardian.name,
			"channel": "Phone",
			"direction": "Outbound",
			"summary": "Called about overdue Term 2 balance.",
		}).insert()

		self.assertEqual(log.logged_by, "Administrator")
		self.assertTrue(log.logged_on)

	def test_summary_required(self):
		guardian = self._make_guardian("B")
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Communication Log",
				"parent_guardian": guardian.name,
				"channel": "SMS",
				"direction": "Outbound",
			}).insert()

	def test_requires_guardian_or_applicant(self):
		# FR-COM-01/04: a pre-enrolment Applicant communication has no real
		# Parent Guardian record to log against yet -- applicant substitutes
		# for it -- but at least one of the two must always be set.
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Communication Log", "channel": "Email", "direction": "Outbound", "summary": "test",
			}).insert()

	def test_accepts_applicant_in_place_of_guardian(self):
		suffix = frappe.generate_hash(length=6)
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"2026 CommLog Test {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"CommLog Test Cat {suffix}"}).insert()
		applicant = frappe.get_doc({
			"doctype": "Applicant", "full_legal_name": "Comm Log Applicant", "date_of_birth": "2014-01-01",
			"academic_year": academic_year.name, "beneficiary_category": category.name,
			"guardian_name": "Guardian", "guardian_phone": "+263771234567",
		}).insert()
		log = frappe.get_doc({
			"doctype": "Communication Log", "applicant": applicant.name, "channel": "Email",
			"direction": "Outbound", "summary": "Application accepted notice",
		}).insert()
		self.assertEqual(log.applicant, applicant.name)
		self.assertFalse(log.parent_guardian)

	def test_sms_skipped_silently_without_gateway_config(self):
		# INT-04: no africastalking_api_key/username is configured on this
		# site, so SMS must be a no-op, not an error and not a fake log entry.
		from edupro_school_fees.notifications import _send_sms

		before = frappe.db.count("Communication Log")
		_send_sms("+263771234567", "Test message")
		after = frappe.db.count("Communication Log")
		self.assertEqual(before, after)

	def test_reversal_receipt_does_not_trigger_payment_confirmation(self):
		# A reversal corrects a past mistake -- it must never be reported to a
		# parent as "payment received." Deterministic regardless of whether
		# this site's outgoing mail is actually configured: the guard clause
		# in notify_receipt_submitted() returns before attempting anything.
		from edupro_school_fees.notifications import notify_receipt_submitted

		reversal = frappe._dict({"reversal_of": "RCPT-DOES-NOT-MATTER", "student": None})
		before = frappe.db.count("Communication Log")
		notify_receipt_submitted(reversal)
		after = frappe.db.count("Communication Log")
		self.assertEqual(before, after)
