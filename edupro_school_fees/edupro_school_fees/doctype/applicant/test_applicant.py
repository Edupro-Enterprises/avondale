"""Student admissions pipeline (FR-APP-01..07, FR-ENR-01..04): an Applicant
captures everything before a decision is made; enrol_applicant() is the
handoff into the real Student registry once Accepted. Every save also
exercises the Applicant.on_update -> notifications.notify_applicant_decision
hook (see test_notifications.py for the notification mechanics themselves --
these tests only need to confirm that hook never blocks a save).
"""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.edupro_school_fees.doctype.applicant.applicant import enrol_applicant


class TestApplicant(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self._grant_workflow_roles()

	def _grant_workflow_roles(self):
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		if "Bursar" not in existing:
			user.append("roles", {"role": "Bursar"})
			user.save(ignore_permissions=True)

	def _make_user(self, email, role):
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", email)
		if not any(r.role == role for r in user.roles):
			user.append("roles", {"role": role})
			user.save(ignore_permissions=True)
		return email

	def _make_applicant(self, suffix, **overrides):
		suffix = f"{suffix}-{frappe.generate_hash(length=6)}"
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"2026 Applicant Test {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"Applicant Test Cat {suffix}"}).insert()

		fields = {
			"doctype": "Applicant",
			"full_legal_name": f"Test Applicant {suffix}",
			"date_of_birth": "2014-05-01",
			"gender": "Male",
			"academic_year": academic_year.name,
			"intended_term": term_name,
			"entry_grade": "Form 1A",
			"beneficiary_category": category.name,
			"guardian_name": f"Test Guardian {suffix}",
			"guardian_phone": "+263771234567",
			"guardian_email": f"guardian-{suffix}@rbac.test",
		}
		fields.update(overrides)
		return frappe.get_doc(fields).insert()

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return account_name

	def test_application_fee_posts_to_gl_once(self):
		# DEF-016: application_fee_amount used to be "informational only" --
		# receipted at the till but never touching the GL.
		self._ensure_account("Cash-in-Till", "Asset")
		self._ensure_account("Application Fees Income", "Income")

		applicant = self._make_applicant(
			"G", application_fee_amount=15, application_fee_currency="ZiG", application_fee_receipt_number="RCPT-APP-001",
		)
		applicant.reload()
		self.assertTrue(applicant.application_fee_journal_entry)

		je = frappe.get_doc("Journal Entry", applicant.application_fee_journal_entry)
		self.assertEqual(je.total_debit, 15)
		self.assertEqual(je.total_credit, 15)

		# Saving again must not post a second entry.
		first_je = applicant.application_fee_journal_entry
		applicant.decision_notes = "no-op change"
		applicant.save()
		applicant.reload()
		self.assertEqual(applicant.application_fee_journal_entry, first_je)

	def test_usd_application_fee_not_auto_posted(self):
		# Scope boundary (matches DEF-006): no per-line currency conversion
		# exists yet, so a USD-denominated fee is left for manual recording
		# rather than silently posted as if it were ZiG.
		self._ensure_account("Cash-in-Till", "Asset")
		self._ensure_account("Application Fees Income", "Income")

		applicant = self._make_applicant(
			"H", application_fee_amount=10, application_fee_currency="USD", application_fee_receipt_number="RCPT-APP-002",
		)
		applicant.reload()
		self.assertFalse(applicant.application_fee_journal_entry)

	def test_declining_requires_notes(self):
		applicant = self._make_applicant("A")
		applicant.status = "Declined"
		with self.assertRaises(frappe.ValidationError):
			applicant.save()

		applicant.reload()
		applicant.status = "Declined"
		applicant.decision_notes = "Did not meet entry requirements"
		applicant.save()
		self.assertEqual(applicant.status, "Declined")

	def test_accept_and_enrol_creates_student_and_guardian(self):
		applicant = self._make_applicant("B")
		applicant.status = "Accepted"
		applicant.save()

		student_name = enrol_applicant(applicant.name)
		student = frappe.get_doc("Student", student_name)
		self.assertEqual(student.first_name, "Test")
		self.assertEqual(student.grade, "Form 1A")
		self.assertEqual(student.status, "Active")
		self.assertEqual(student.academic_year, applicant.academic_year)

		guardian = frappe.get_doc("Parent Guardian", student.guardian)
		self.assertEqual(guardian.phone_number, "+263771234567")

		applicant.reload()
		self.assertEqual(applicant.enrolled_student, student_name)
		self.assertTrue(applicant.enrolled_on)

	def test_enrol_records_mopse_admission_number_when_given(self):
		# DEF-015: no code path ever set this field before -- it's optional
		# (this app can't generate a real one), but must actually be stored
		# when a Bursar has it in hand at enrolment.
		applicant = self._make_applicant("F")
		applicant.status = "Accepted"
		applicant.save()

		student_name = enrol_applicant(applicant.name, mopse_admission_number="MOPSE-2026-00042")
		student = frappe.get_doc("Student", student_name)
		self.assertEqual(student.mopse_admission_number, "MOPSE-2026-00042")

	def test_cannot_enrol_twice(self):
		applicant = self._make_applicant("C")
		applicant.status = "Accepted"
		applicant.save()
		enrol_applicant(applicant.name)

		with self.assertRaises(frappe.ValidationError):
			enrol_applicant(applicant.name)

	def test_cannot_enrol_non_accepted_applicant(self):
		applicant = self._make_applicant("D")
		with self.assertRaises(frappe.ValidationError):
			enrol_applicant(applicant.name)

	def test_only_bursar_can_enrol(self):
		applicant = self._make_applicant("E")
		applicant.status = "Accepted"
		applicant.save()

		auditor = self._make_user("applicant-auditor@rbac.test", "District Education Auditor/Inspector")
		frappe.set_user(auditor)
		with self.assertRaises(frappe.PermissionError):
			enrol_applicant(applicant.name)
		frappe.set_user("Administrator")

	def test_school_head_can_change_status_but_not_enrol(self):
		applicant = self._make_applicant("F")
		head = self._make_user("applicant-head@rbac.test", "School Head")

		frappe.set_user(head)
		doc = frappe.get_doc("Applicant", applicant.name)
		doc.status = "Accepted"
		doc.save()
		self.assertEqual(doc.status, "Accepted")

		with self.assertRaises(frappe.PermissionError):
			enrol_applicant(applicant.name)
		frappe.set_user("Administrator")
