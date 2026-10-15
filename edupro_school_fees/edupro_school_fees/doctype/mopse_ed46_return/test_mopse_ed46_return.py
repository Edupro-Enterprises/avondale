import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.edupro_school_fees.doctype.mopse_ed46_return.mopse_ed46_return import generate_ed46_return


def _valid_banking_rows():
	return [
		{"bank_name": "Test Bank", "account_name": "Tuition ZiG", "account_number": "ED46-001", "currency_type": "ZiG", "fee_stream": "Tuition", "is_active": 1},
		{"bank_name": "Test Bank", "account_name": "Tuition FCA", "account_number": "ED46-002", "currency_type": "FCA", "fee_stream": "Tuition", "is_active": 1},
		{"bank_name": "Test Bank", "account_name": "Levy ZiG", "account_number": "ED46-003", "currency_type": "ZiG", "fee_stream": "Levy/SDC", "is_active": 1},
		{"bank_name": "Test Bank", "account_name": "Levy FCA", "account_number": "ED46-004", "currency_type": "FCA", "fee_stream": "Levy/SDC", "is_active": 1},
	]


class TestMoPSEED46Return(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		# School Setup is a hard singleton -- reuse whatever already exists (this
		# codebase has had a real one since Phase 1/2.1) rather than deleting it,
		# unlike test_school_setup.py's own setUp(); only create one if genuinely
		# none exists yet (e.g. a from-scratch test DB).
		if not frappe.db.exists("School Setup", {}):
			frappe.get_doc({
				"doctype": "School Setup", "school_name": "ED46 Test School", "registration_number": "REG-ED46",
				"emis_number": "EMIS-ED46", "school_code": "E46", "physical_address": "1 Test Street",
				"district": "Test District", "region": "Test Region",
				"banking_configuration": _valid_banking_rows(),
			}).insert()

	def _make_term(self, suffix):
		# Academic Year's own controller auto-generates 3 Terms on insert -- reuse
		# the auto-generated Term 1 rather than inserting a duplicate (which
		# Term._validate_term_sequence() rejects).
		academic_year = f"2026 ED46 Test Year {suffix}"
		frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": academic_year,
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		term = frappe.db.get_value("Term", {"academic_year": academic_year, "term_number": 1}, "name")
		return term, academic_year

	def _co_sign_fee_structure(self, fs):
		from edupro_school_fees.edupro_school_fees.doctype.fee_structure.fee_structure import co_sign_fee_structure

		head = self._make_user("fs-cosign-head@rbac.test", "School Head")
		sdc = self._make_user("fs-cosign-sdc@rbac.test", "SDC Chairperson/Treasurer")
		current_user = frappe.session.user
		frappe.set_user(head)
		co_sign_fee_structure(fs.name)
		frappe.set_user(sdc)
		co_sign_fee_structure(fs.name)
		frappe.set_user(current_user)
		fs.reload()

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

	def test_generate_snapshots_header_and_computes_enrolment(self):
		term, academic_year = self._make_term("A")
		frappe.get_doc({
			"doctype": "Beneficiary Category", "category_name": "ED46 Test Category",
		}).insert(ignore_permissions=True) if not frappe.db.exists("Beneficiary Category", "ED46 Test Category") else None
		frappe.get_doc({
			"doctype": "Student", "first_name": "ED46", "last_name": "Student", "admission_date": "2026-01-10",
			"academic_year": academic_year, "beneficiary_category": "ED46 Test Category", "status": "Active",
		}).insert()

		name = generate_ed46_return(term)
		doc = frappe.get_doc("MoPSE ED46 Return", name)

		self.assertEqual(doc.total_enrolment, 1)
		self.assertEqual(doc.workflow_state, "Draft")
		setup = frappe.get_doc("School Setup", frappe.db.get_value("School Setup", {}, "name"))
		self.assertEqual(doc.school_name, setup.school_name)

	def test_generate_computes_billed_and_realized_revenue(self):
		term, academic_year = self._make_term("B")
		income = "ED46 Test Income"
		if not frappe.db.exists("Account", income):
			frappe.get_doc({"doctype": "Account", "account_name": income, "account_type": "Income", "currency": "ZiG"}).insert()
		if not frappe.db.exists("Beneficiary Category", "ED46 Test Category B"):
			frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "ED46 Test Category B"}).insert()
		cash = "ED46 Test Cash"
		if not frappe.db.exists("Account", cash):
			frappe.get_doc({"doctype": "Account", "account_name": cash, "account_type": "Asset", "currency": "ZiG"}).insert()
		if not frappe.db.exists("Payment Method", "ED46 Test Cash Method"):
			frappe.get_doc({"doctype": "Payment Method", "method_name": "ED46 Test Cash Method", "account": cash, "currency": "ZiG"}).insert()
		if not frappe.db.exists("Fee Item", "ED46 Test Tuition"):
			frappe.get_doc({"doctype": "Fee Item", "item_name": "ED46 Test Tuition", "default_amount": 100, "account": income}).insert()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "ED46B", "last_name": "Student", "admission_date": "2026-01-10",
			"academic_year": academic_year, "beneficiary_category": "ED46 Test Category B", "status": "Active",
		}).insert()

		# Invoice requires an Approved Fee Structure -- walk the real 2-hop
		# workflow (Bursar drafts, Fees Approver approves) as the Bank
		# Reconciliation/Requisition tests already establish the pattern for.
		bursar = self._make_user("ed46-fs-bursar-b@rbac.test", "Bursar")
		approver = self._make_user("ed46-fs-approver-b@rbac.test", "Fees Approver")
		frappe.set_user(bursar)
		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": "ED46 Test Fees B", "academic_year": academic_year,
			"term": term, "beneficiary_category": "ED46 Test Category B",
			"items": [{"fee_item": "ED46 Test Tuition", "amount": 100, "account": income}],
			"agm_minutes": "/files/ed46-test-agm.pdf", "mopse_approval_letter": "/files/ed46-test-mopse.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		frappe.set_user("Administrator")
		self._co_sign_fee_structure(fee_structure)
		frappe.set_user(approver)
		fee_structure.reload()
		fee_structure.workflow_state = "Approved"
		fee_structure.save()
		frappe.set_user("Administrator")

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"academic_year": academic_year, "term": term, "posting_date": "2026-02-01", "due_date": "2026-03-01",
			"items": [{"fee_item": "ED46 Test Tuition", "description": "Tuition", "amount": 100, "account": income}],
		}).insert()
		invoice.submit()

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student.name, "invoice": invoice.name,
			"payment_method": "ED46 Test Cash Method", "currency": "ZiG", "amount": 40, "posting_date": "2026-02-10",
		}).insert()
		receipt.submit()

		name = generate_ed46_return(term)
		doc = frappe.get_doc("MoPSE ED46 Return", name)
		self.assertEqual(doc.total_revenue_billed, 100)
		self.assertEqual(doc.levy_base_amount, 100)
		self.assertEqual(doc.total_revenue_realized, 40)

	def test_three_party_certification_reaches_certified(self):
		term, _ = self._make_term("C")
		name = generate_ed46_return(term)

		bursar = self._make_user("ed46-bursar@rbac.test", "Bursar")
		head = self._make_user("ed46-head@rbac.test", "School Head")
		sdc = self._make_user("ed46-sdc@rbac.test", "SDC Chairperson/Treasurer")

		from edupro_school_fees.edupro_school_fees.doctype.mopse_ed46_return.mopse_ed46_return import (
			certify_as_bursar, certify_as_school_head, certify_as_sdc_chair,
		)

		frappe.set_user(bursar)
		certify_as_bursar(name)
		doc = frappe.get_doc("MoPSE ED46 Return", name)
		self.assertEqual(doc.workflow_state, "Pending Certification")

		frappe.set_user(sdc)
		certify_as_sdc_chair(name)

		frappe.set_user(head)
		certify_as_school_head(name)

		frappe.set_user("Administrator")
		doc.reload()
		self.assertEqual(doc.workflow_state, "Certified")
		self.assertTrue(doc.certified_on)

	def test_wrong_role_cannot_certify(self):
		term, _ = self._make_term("D")
		name = generate_ed46_return(term)
		bursar = self._make_user("ed46-bursar-d@rbac.test", "Bursar")

		from edupro_school_fees.edupro_school_fees.doctype.mopse_ed46_return.mopse_ed46_return import certify_as_school_head

		frappe.set_user(bursar)
		with self.assertRaises(frappe.PermissionError):
			certify_as_school_head(name)

	def test_regenerate_blocked_once_certified(self):
		term, _ = self._make_term("E")
		name = generate_ed46_return(term)

		bursar = self._make_user("ed46-bursar-e@rbac.test", "Bursar")
		head = self._make_user("ed46-head-e@rbac.test", "School Head")
		sdc = self._make_user("ed46-sdc-e@rbac.test", "SDC Chairperson/Treasurer")
		from edupro_school_fees.edupro_school_fees.doctype.mopse_ed46_return.mopse_ed46_return import (
			certify_as_bursar, certify_as_school_head, certify_as_sdc_chair,
		)
		frappe.set_user(bursar)
		certify_as_bursar(name)
		frappe.set_user(sdc)
		certify_as_sdc_chair(name)
		frappe.set_user(head)
		certify_as_school_head(name)

		frappe.set_user("Administrator")
		with self.assertRaises(frappe.ValidationError):
			generate_ed46_return(term)
