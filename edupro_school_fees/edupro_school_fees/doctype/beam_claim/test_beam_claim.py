import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.edupro_school_fees.doctype.beam_claim.beam_claim import get_beam_reconciliation


class TestBEAMClaim(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _academic_year(self, suffix):
		# Each test gets its own Academic Year -- Term enforces one Term per
		# term_number per Academic Year, so a shared year across tests that each
		# create a "Term 1" would collide on the second test.
		academic_year = f"2026 BEAM Test Year {suffix}"
		if not frappe.db.exists("Academic Year", academic_year):
			frappe.get_doc({
				"doctype": "Academic Year", "academic_year_name": academic_year,
				"start_date": "2026-01-01", "end_date": "2026-12-31",
			}).insert()
		return academic_year

	def _make_student(self, suffix, grade="Grade 5"):
		academic_year = self._academic_year(suffix)
		if not frappe.db.exists("Beneficiary Category", "BEAM Test Category"):
			frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "BEAM Test Category"}).insert()

		return frappe.get_doc({
			"doctype": "Student", "first_name": f"BEAM{suffix}", "last_name": "Student",
			"admission_date": "2026-01-10", "academic_year": academic_year,
			"beneficiary_category": "BEAM Test Category", "grade": grade,
		}).insert()

	def _make_term(self, suffix):
		# Academic Year's own controller auto-generates 3 Terms on insert -- reuse
		# the auto-generated Term 1 rather than inserting a duplicate.
		academic_year = self._academic_year(suffix)
		return frappe.db.get_value("Term", {"academic_year": academic_year, "term_number": 1}, "name")

	def test_reconciliation_computes_unpaid_and_cumulative(self):
		student = self._make_student("A")
		term = self._make_term("A")

		frappe.get_doc({
			"doctype": "BEAM Claim", "student": student.name, "term": term, "claim_date": "2026-02-01",
			"tuition_arrears_claimed": 200, "sdc_levy_arrears_claimed": 50, "treasury_amount_disbursed": 100,
		}).insert()
		frappe.get_doc({
			"doctype": "BEAM Claim", "student": student.name, "term": term, "claim_date": "2026-03-01",
			"tuition_arrears_claimed": 80, "sdc_levy_arrears_claimed": 0, "treasury_amount_disbursed": 0,
		}).insert()

		result = get_beam_reconciliation(term=term)
		rows = [r for r in result["rows"] if r["student"] == student.name]
		self.assertEqual(len(rows), 2)

		first, second = rows[0], rows[1]
		self.assertEqual(first["unpaid_claim"], 150)  # (200+50) - 100
		self.assertEqual(second["unpaid_claim"], 80)  # (80+0) - 0
		self.assertEqual(second["cumulative_unpaid_claim"], 230)  # 150 + 80, running total
		self.assertEqual(first["grade"], "Grade 5")
		self.assertEqual(first["student_name"], "BEAMA Student")

	def test_reconciliation_totals(self):
		student = self._make_student("B")
		term = self._make_term("B")
		frappe.get_doc({
			"doctype": "BEAM Claim", "student": student.name, "term": term, "claim_date": "2026-02-01",
			"tuition_arrears_claimed": 300, "sdc_levy_arrears_claimed": 20, "treasury_amount_disbursed": 250,
		}).insert()

		result = get_beam_reconciliation(term=term)
		self.assertEqual(result["totals"]["total_tuition_claimed"], 300)
		self.assertEqual(result["totals"]["total_sdc_levy_claimed"], 20)
		self.assertEqual(result["totals"]["total_disbursed"], 250)
		self.assertEqual(result["totals"]["total_unpaid"], 70)

	def test_negative_disbursement_rejected(self):
		student = self._make_student("C")
		term = self._make_term("C")
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "BEAM Claim", "student": student.name, "term": term, "claim_date": "2026-02-01",
				"treasury_amount_disbursed": -10,
			}).insert()

	def _co_sign_fee_structure(self, fs):
		from edupro_school_fees.edupro_school_fees.doctype.fee_structure.fee_structure import co_sign_fee_structure

		for role in ("School Head", "SDC Chairperson/Treasurer"):
			email = f"beam-cosign-{role.split()[0].lower()}@rbac.test"
			if not frappe.db.exists("User", email):
				frappe.get_doc({
					"doctype": "User", "email": email, "first_name": "Beam", "send_welcome_email": 0,
				}).insert(ignore_permissions=True)
			user = frappe.get_doc("User", email)
			if not any(r.role == role for r in user.roles):
				user.append("roles", {"role": role})
				user.save(ignore_permissions=True)
			frappe.set_user(email)
			co_sign_fee_structure(fs.name)
		frappe.set_user("Administrator")
		fs.reload()

	def _make_invoice(self, suffix, amount=100):
		student = self._make_student(suffix)
		term = self._make_term(suffix)
		academic_year = self._academic_year(suffix)

		income = "BEAM Test Income"
		if not frappe.db.exists("Account", income):
			frappe.get_doc({"doctype": "Account", "account_name": income, "account_type": "Income", "currency": "ZiG"}).insert()
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"BEAM Test Fee {suffix}", "default_amount": amount, "account": income,
		}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"BEAM Test Structure {suffix}",
			"academic_year": academic_year, "term": term,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()
		return student, term, invoice

	def test_claim_exceeding_linked_invoice_total_is_blocked(self):
		# DEF-011: a BEAM Claim with a linked Invoice cannot claim more than
		# was actually billed on it.
		student, term, invoice = self._make_invoice("D", amount=100)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "BEAM Claim", "student": student.name, "term": term, "invoice": invoice.name,
				"claim_date": "2026-02-01", "tuition_arrears_claimed": 150,
			}).insert()

	def test_claim_within_linked_invoice_total_is_allowed(self):
		student, term, invoice = self._make_invoice("E", amount=100)
		claim = frappe.get_doc({
			"doctype": "BEAM Claim", "student": student.name, "term": term, "invoice": invoice.name,
			"claim_date": "2026-02-01", "tuition_arrears_claimed": 100,
		}).insert()
		self.assertEqual(claim.invoice, invoice.name)

	def test_claim_linked_to_another_students_invoice_is_blocked(self):
		student_a, term, invoice_a = self._make_invoice("F", amount=100)
		student_b = self._make_student("G")
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "BEAM Claim", "student": student_b.name, "term": term, "invoice": invoice_a.name,
				"claim_date": "2026-02-01", "tuition_arrears_claimed": 50,
			}).insert()

	def test_reconciliation_blocked_for_portal_roles(self):
		parent_email = "beam-parent@rbac.test"
		if not frappe.db.exists("User", parent_email):
			user = frappe.get_doc({
				"doctype": "User", "email": parent_email, "first_name": "Beam", "send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", parent_email)
		if not any(r.role == "Parent/Guardian" for r in user.roles):
			user.append("roles", {"role": "Parent/Guardian"})
			user.save(ignore_permissions=True)

		frappe.set_user(parent_email)
		with self.assertRaises(frappe.PermissionError):
			get_beam_reconciliation()
