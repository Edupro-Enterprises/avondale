"""Portal RBAC (Phase 5.1) hard gate: a Parent/Guardian or Student portal user may
see their own family's records and nothing else -- checked both as a list query
(permission_query_conditions) and as a direct single-record fetch
(has_permission), since the two are separate enforcement layers and a gap in
either one is a real IDOR vulnerability. Internal roles (Bursar) must be
completely unaffected by any of this.
"""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestPortalRBAC(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account",
				"account_name": account_name,
				"account_type": account_type,
				"currency": "ZiG",
			}).insert()
		return account_name

	def _make_portal_user(self, email, role):
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

	def _co_sign_fee_structure(self, fs):
		from edupro_school_fees.edupro_school_fees.doctype.fee_structure.fee_structure import co_sign_fee_structure

		head = self._make_portal_user("fs-cosign-head@rbac.test", "School Head")
		sdc = self._make_portal_user("fs-cosign-sdc@rbac.test", "SDC Chairperson/Treasurer")
		current_user = frappe.session.user
		frappe.set_user(head)
		co_sign_fee_structure(fs.name)
		frappe.set_user(sdc)
		co_sign_fee_structure(fs.name)
		frappe.set_user(current_user)
		fs.reload()

	def _make_family(self, suffix, amount=100):
		"""One guardian, one student, an Approved Fee Structure, a submitted
		Invoice, and a submitted Receipt -- the full set of doctypes Phase 5.1
		scopes."""
		income = self._ensure_account(f"Fees Income", "Income")
		self._ensure_account("Debtors", "Asset")
		cash = self._ensure_account("Cash-in-Till", "Asset")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": f"RBAC Test Year {suffix}",
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name"
		)[0]

		category = frappe.get_doc({
			"doctype": "Beneficiary Category",
			"category_name": f"RBAC Test Category {suffix}",
		}).insert()

		fee_item = frappe.get_doc({
			"doctype": "Fee Item",
			"item_name": f"RBAC Test Fee Item {suffix}",
			"default_amount": amount,
			"account": income,
		}).insert()

		bursar_email = self._make_portal_user(f"bursar-{suffix}@rbac.test", "Bursar")
		bursar = frappe.get_doc("User", bursar_email)
		if not any(r.role == "Fees Approver" for r in bursar.roles):
			bursar.append("roles", {"role": "Fees Approver"})
			bursar.save(ignore_permissions=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure",
			"structure_name": f"RBAC Test Structure {suffix}",
			"academic_year": academic_year.name,
			"term": term_name,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/agm.pdf",
			"mopse_approval_letter": "/files/mopse.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		guardian_email = self._make_portal_user(f"guardian-{suffix}@rbac.test", "Parent/Guardian")
		guardian = frappe.get_doc({
			"doctype": "Parent Guardian",
			"full_name": f"RBAC Guardian {suffix}",
			"phone_number": "0771234567",
			"user": guardian_email,
		}).insert()

		student_email = self._make_portal_user(f"student-{suffix}@rbac.test", "Student")
		student = frappe.get_doc({
			"doctype": "Student",
			"first_name": "RBAC",
			"last_name": f"Student {suffix}",
			"admission_date": "2026-01-05",
			"academic_year": academic_year.name,
			"beneficiary_category": category.name,
			"guardian": guardian.name,
			"user": student_email,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice",
			"student": student.name,
			"fee_structure": fee_structure.name,
			"posting_date": "2026-01-10",
			"items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()

		payment_method = frappe.get_doc({
			"doctype": "Payment Method",
			"method_name": f"RBAC Cash {suffix}",
			"account": cash,
			"currency": "ZiG",
		}).insert()

		receipt = frappe.get_doc({
			"doctype": "Receipt",
			"student": student.name,
			"invoice": invoice.name,
			"payment_method": payment_method.name,
			"amount": amount,
			"posting_date": "2026-01-11",
		}).insert()
		receipt.submit()

		return {
			"guardian": guardian,
			"guardian_email": guardian_email,
			"student": student,
			"student_email": student_email,
			"invoice": invoice,
			"receipt": receipt,
			"fee_structure": fee_structure,
		}

	def test_parent_sees_own_family_only(self):
		family_a = self._make_family("A")
		family_b = self._make_family("B")

		frappe.set_user(family_a["guardian_email"])

		# Positive: own records, by list and by direct fetch. frappe.get_list()
		# (not get_all(), which bypasses user permissions by design) is what
		# actually exercises permission_query_conditions.
		self.assertIn(family_a["student"].name, frappe.get_list("Student", pluck="name"))
		self.assertIn(family_a["invoice"].name, frappe.get_list("Invoice", pluck="name"))
		self.assertIn(family_a["receipt"].name, frappe.get_list("Receipt", pluck="name"))
		self.assertTrue(frappe.has_permission("Student", doc=family_a["student"].name, ptype="read"))
		self.assertTrue(frappe.has_permission("Invoice", doc=family_a["invoice"].name, ptype="read"))
		self.assertTrue(frappe.has_permission("Receipt", doc=family_a["receipt"].name, ptype="read"))
		self.assertTrue(
			frappe.has_permission("Parent Guardian", doc=family_a["guardian"].name, ptype="read")
		)

		# Negative: family B's records must not appear in list queries...
		self.assertNotIn(family_b["student"].name, frappe.get_list("Student", pluck="name"))
		self.assertNotIn(family_b["invoice"].name, frappe.get_list("Invoice", pluck="name"))
		self.assertNotIn(family_b["receipt"].name, frappe.get_list("Receipt", pluck="name"))

		# ...and must not be fetchable directly by name either (the IDOR case).
		self.assertFalse(frappe.has_permission("Student", doc=family_b["student"].name, ptype="read"))
		self.assertFalse(frappe.has_permission("Invoice", doc=family_b["invoice"].name, ptype="read"))
		self.assertFalse(frappe.has_permission("Receipt", doc=family_b["receipt"].name, ptype="read"))
		self.assertFalse(
			frappe.has_permission("Parent Guardian", doc=family_b["guardian"].name, ptype="read")
		)
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc("Invoice", family_b["invoice"].name).check_permission("read")

	def test_withdrawal_blocked_with_outstanding_balance_unless_cleared(self):
		# DEF-014: a student could be marked Withdrawn/Transferred Out with
		# zero check against an open Invoice balance.
		income = self._ensure_account("Fees Income", "Income")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "RBAC Test Year DEF014",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "RBAC Test Category DEF014"}).insert()
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "RBAC Test Fee Item DEF014", "default_amount": 100, "account": income,
		}).insert()

		bursar_email = self._make_portal_user("bursar-def014@rbac.test", "Bursar")
		bursar = frappe.get_doc("User", bursar_email)
		if not any(r.role == "Fees Approver" for r in bursar.roles):
			bursar.append("roles", {"role": "Fees Approver"})
			bursar.save(ignore_permissions=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": "RBAC Test Structure DEF014",
			"academic_year": academic_year.name, "term": term_name,
			"items": [{"fee_item": fee_item.name, "amount": 100}],
			"agm_minutes": "/files/agm.pdf", "mopse_approval_letter": "/files/mopse.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "DEF014", "last_name": "Student",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_item.name, "amount": 100}],
		}).insert().submit()

		student.reload()
		student.status = "Withdrawn"
		with self.assertRaises(frappe.ValidationError):
			student.save()

		student.reload()
		student.status = "Withdrawn"
		student.clearance_certificate_number = "CC-DEF014-001"
		student.save()
		self.assertEqual(student.status, "Withdrawn")

	def test_secondary_guardian_sees_own_family_too(self):
		# DEF-027: a guardian linked only via Student.secondary_guardian (not the
		# primary "guardian" Link) used to be denied all portal access to their
		# own child -- a real access-denial bug, not a leak.
		income = self._ensure_account("Fees Income", "Income")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "RBAC Test Year SecG",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "RBAC Test Category SecG"}).insert()

		primary_email = self._make_portal_user("guardian-secg-primary@rbac.test", "Parent/Guardian")
		primary_guardian = frappe.get_doc({
			"doctype": "Parent Guardian", "full_name": "RBAC Primary Guardian SecG",
			"phone_number": "0771234568", "user": primary_email,
		}).insert()

		secondary_email = self._make_portal_user("guardian-secg-secondary@rbac.test", "Parent/Guardian")
		secondary_guardian = frappe.get_doc({
			"doctype": "Parent Guardian", "full_name": "RBAC Secondary Guardian SecG",
			"phone_number": "0771234569", "user": secondary_email,
		}).insert()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "RBAC", "last_name": "Student SecG",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
			"guardian": primary_guardian.name, "secondary_guardian": secondary_guardian.name,
		}).insert()

		frappe.set_user(secondary_email)
		self.assertIn(student.name, frappe.get_list("Student", pluck="name"))
		self.assertTrue(frappe.has_permission("Student", doc=student.name, ptype="read"))

	def test_student_sees_own_records_only_and_never_receipts(self):
		family_a = self._make_family("C")
		family_b = self._make_family("D")

		frappe.set_user(family_a["student_email"])

		self.assertIn(family_a["student"].name, frappe.get_list("Student", pluck="name"))
		self.assertIn(family_a["invoice"].name, frappe.get_list("Invoice", pluck="name"))
		self.assertTrue(frappe.has_permission("Student", doc=family_a["student"].name, ptype="read"))
		self.assertTrue(frappe.has_permission("Invoice", doc=family_a["invoice"].name, ptype="read"))

		self.assertNotIn(family_b["student"].name, frappe.get_list("Student", pluck="name"))
		self.assertNotIn(family_b["invoice"].name, frappe.get_list("Invoice", pluck="name"))
		self.assertFalse(frappe.has_permission("Student", doc=family_b["student"].name, ptype="read"))
		self.assertFalse(frappe.has_permission("Invoice", doc=family_b["invoice"].name, ptype="read"))

		# Students are never granted Receipt access at all (spec: only Parent/
		# Guardian downloads receipts) -- not even their own. No DocPerm row
		# grants Student any read on Receipt, so get_list() itself is denied
		# outright rather than returning an empty result.
		with self.assertRaises(frappe.PermissionError):
			frappe.get_list("Receipt", pluck="name")
		self.assertFalse(frappe.has_permission("Receipt", doc=family_a["receipt"].name, ptype="read"))

	def test_fee_structure_visible_only_once_approved(self):
		family_a = self._make_family("E")

		draft_fs = frappe.get_doc({
			"doctype": "Fee Structure",
			"structure_name": "RBAC Draft Structure",
			"academic_year": family_a["student"].academic_year,
			"term": family_a["invoice"].term,
			"items": [{"fee_item": family_a["invoice"].items[0].fee_item, "amount": 50}],
		}).insert()

		frappe.set_user(family_a["guardian_email"])

		self.assertIn(family_a["fee_structure"].name, frappe.get_list("Fee Structure", pluck="name"))
		self.assertTrue(
			frappe.has_permission("Fee Structure", doc=family_a["fee_structure"].name, ptype="read")
		)
		self.assertNotIn(draft_fs.name, frappe.get_list("Fee Structure", pluck="name"))
		self.assertFalse(frappe.has_permission("Fee Structure", doc=draft_fs.name, ptype="read"))

	def test_internal_roles_unaffected_by_portal_scoping(self):
		family_a = self._make_family("F")
		family_b = self._make_family("G")

		frappe.set_user(f"bursar-F@rbac.test")

		# A Bursar must still see every family's records -- the portal
		# query-condition/has_permission hooks must be a pure no-op for them.
		all_students = frappe.get_list("Student", pluck="name")
		self.assertIn(family_a["student"].name, all_students)
		self.assertIn(family_b["student"].name, all_students)
		self.assertTrue(frappe.has_permission("Invoice", doc=family_b["invoice"].name, ptype="read"))

	def test_payment_plan_visible_only_to_own_guardian(self):
		family_a = self._make_family("H")
		family_b = self._make_family("I")

		frappe.set_user("Administrator")
		case_a = frappe.get_doc({"doctype": "Debtor Case", "student": family_a["student"].name}).insert()
		plan_a = frappe.get_doc({
			"doctype": "Payment Plan",
			"debtor_case": case_a.name,
			"student": family_a["student"].name,
			"total_amount": 100,
			"start_date": "2026-02-01",
			"installments": [{"due_date": "2026-03-01", "amount": 100}],
		}).insert()

		frappe.set_user(family_a["guardian_email"])
		self.assertIn(plan_a.name, frappe.get_list("Payment Plan", pluck="name"))
		self.assertTrue(frappe.has_permission("Payment Plan", doc=plan_a.name, ptype="read"))

		frappe.set_user(family_b["guardian_email"])
		self.assertNotIn(plan_a.name, frappe.get_list("Payment Plan", pluck="name"))
		self.assertFalse(frappe.has_permission("Payment Plan", doc=plan_a.name, ptype="read"))

		# Student never gets Payment Plan access at all (guardian-level matter).
		frappe.set_user(family_a["student_email"])
		with self.assertRaises(frappe.PermissionError):
			frappe.get_list("Payment Plan", pluck="name")

	def test_census_return_counts_by_grade_and_gender(self):
		from edupro_school_fees.statutory_reports_extra import get_census_return

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "Census Test Year",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "Census Test Cat"}).insert(ignore_if_duplicate=True)

		frappe.get_doc({
			"doctype": "Student", "first_name": "CensusA", "last_name": "Test", "admission_date": "2026-01-05",
			"academic_year": academic_year.name, "beneficiary_category": category.name,
			"grade": "Grade 5", "gender": "Female", "is_boarder": 1, "vulnerability_classification": "Orphan",
		}).insert()
		frappe.get_doc({
			"doctype": "Student", "first_name": "CensusB", "last_name": "Test", "admission_date": "2026-01-05",
			"academic_year": academic_year.name, "beneficiary_category": category.name,
			"grade": "Grade 5", "gender": "Male",
		}).insert()

		result = get_census_return(academic_year.name)
		self.assertEqual(result["total_enrolment"], 2)
		self.assertEqual(result["by_gender"], {"Male": 1, "Female": 1})
		self.assertEqual(result["boarders"], 1)
		self.assertEqual(result["day_scholars"], 1)
		grade_5 = next(row for row in result["by_grade"] if row["grade"] == "Grade 5")
		self.assertEqual(grade_5["count"], 2)
