"""Credit Note: a write-off is never a payment (no cash moves) -- Dr Bad Debts
Written Off / Cr Debtors, gated by a School Head approval, mirroring Receipt
reversal's "authorized supervisor" pattern but for the opposite kind of
correction (forgiving a debt, not un-receipting a payment)."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestCreditNote(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("Bursar", "Fees Approver", "School Head") if r not in existing]
		if missing:
			for role in missing:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return account_name

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

	def _make_invoice(self, suffix, amount=100):
		debtors = self._ensure_account("Debtors", "Asset")
		income = self._ensure_account("Fees Income", "Income")
		self._ensure_account("Bad Debts Written Off", "Expense")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"CN Test Year {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"CN Test Cat {suffix}"}).insert(ignore_if_duplicate=True)
		fee_item = frappe.get_doc({"doctype": "Fee Item", "item_name": f"CN Test Fee {suffix}", "default_amount": amount, "account": income}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"CN Test Structure {suffix}",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": category.name,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": f"CN{suffix}", "last_name": "Test",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()
		return student.name, invoice.name

	def test_amount_cannot_exceed_outstanding_balance(self):
		_student, invoice = self._make_invoice("A", amount=100)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Credit Note", "invoice": invoice, "amount": 150, "reason": "Test", "posting_date": "2026-01-15",
			}).insert()

	def test_approval_posts_write_off_and_reduces_invoice(self):
		bursar = self._make_user("cn-bursar-b@rbac.test", "Bursar")
		head = self._make_user("cn-head-b@rbac.test", "School Head")

		_student, invoice = self._make_invoice("B", amount=100)

		frappe.set_user(bursar)
		note = frappe.get_doc({
			"doctype": "Credit Note", "invoice": invoice, "amount": 40,
			"reason": "Family hardship, partial write-off", "posting_date": "2026-01-15",
		}).insert()

		frappe.set_user(head)
		note.reload()
		note.workflow_state = "Approved"
		note.save()

		self.assertEqual(note.workflow_state, "Approved")
		self.assertTrue(note.approved_on)

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 60)
		self.assertEqual(invoice_doc.status, "Partly Paid")

		je_name = frappe.db.get_value("Journal Entry", {"reference_doctype": "Credit Note", "reference_name": note.name}, "name")
		self.assertTrue(je_name)
		je = frappe.get_doc("Journal Entry", je_name)
		self.assertEqual(je.total_debit, 40)
		self.assertEqual(je.total_credit, 40)

	def test_non_school_head_cannot_approve(self):
		# DEF-002: approval used to check only "is this a different person than
		# the drafter", never "does this person actually hold School Head" --
		# so any Bursar could approve a colleague's write-off, defeating the
		# two-person control entirely.
		drafter = self._make_user("cn-bursar-e@rbac.test", "Bursar")
		other_bursar = self._make_user("cn-bursar-e2@rbac.test", "Bursar")

		_student, invoice = self._make_invoice("E", amount=100)

		frappe.set_user(drafter)
		note = frappe.get_doc({
			"doctype": "Credit Note", "invoice": invoice, "amount": 20, "reason": "Test", "posting_date": "2026-01-15",
		}).insert()

		frappe.set_user(other_bursar)
		note.reload()
		note.workflow_state = "Approved"
		with self.assertRaises(frappe.PermissionError):
			note.save()

	def test_same_person_cannot_draft_and_approve(self):
		bursar_head = self._make_user("cn-dual-c@rbac.test", "Bursar")
		self._make_user("cn-dual-c@rbac.test", "School Head")

		_student, invoice = self._make_invoice("C", amount=100)

		frappe.set_user(bursar_head)
		note = frappe.get_doc({
			"doctype": "Credit Note", "invoice": invoice, "amount": 20, "reason": "Test", "posting_date": "2026-01-15",
		}).insert()
		note.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			note.save()

	def test_approved_credit_note_cannot_be_deleted(self):
		bursar = self._make_user("cn-bursar-d@rbac.test", "Bursar")
		head = self._make_user("cn-head-d@rbac.test", "School Head")

		_student, invoice = self._make_invoice("D", amount=100)

		frappe.set_user(bursar)
		note = frappe.get_doc({
			"doctype": "Credit Note", "invoice": invoice, "amount": 20, "reason": "Test", "posting_date": "2026-01-15",
		}).insert()

		frappe.set_user(head)
		note.reload()
		note.workflow_state = "Approved"
		note.save()

		# No role holds delete:1 on Credit Note at all, so DocPerm itself blocks
		# this before on_trash() is even reached -- an even stronger guarantee
		# than the ValidationError on_trash() provides as defense-in-depth.
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("Credit Note", note.name)
