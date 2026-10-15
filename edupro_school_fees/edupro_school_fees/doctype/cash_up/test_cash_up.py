"""Daily cash-up (FR-CSH-01..04): a cashier reconciles what the system says
they received against what they physically counted, per payment method, for
one day. A variance beyond the configured threshold flags the cash-up and
locks that cashier out of recording new receipts (Receipt.validate()) until
a School Head resolves it.
"""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.edupro_school_fees.doctype.cash_up.cash_up import (
	resolve_cash_up,
	submit_cash_up,
)


class TestCashUp(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self._grant_workflow_roles()

	def _grant_workflow_roles(self):
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("Bursar", "Fees Approver") if r not in existing]
		if missing:
			for role in missing:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)

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

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return account_name

	def _make_receipt(self, suffix, cashier, amount, posting_date):
		income = self._ensure_account(f"CashUp Test Income", "Income")
		cash = self._ensure_account(f"CashUp Test Cash", "Asset")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"2026 CashUp Test {frappe.generate_hash(length=6)}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"CashUp Test Cat {suffix}"}).insert(ignore_if_duplicate=True)
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"CashUp Test Fee {suffix}", "default_amount": amount, "account": income,
		}).insert(ignore_if_duplicate=True)
		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"CashUp Test Structure {suffix}",
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
			"doctype": "Student", "first_name": f"CashUp{suffix}", "last_name": "Test",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()
		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": posting_date, "items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()

		payment_method = frappe.get_doc({
			"doctype": "Payment Method", "method_name": f"CashUp Test Method {suffix}", "account": cash, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		frappe.set_user(cashier)
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student.name, "invoice": invoice.name,
			"payment_method": payment_method.name, "amount": amount, "posting_date": posting_date,
		}).insert()
		receipt.submit()
		frappe.set_user("Administrator")
		return payment_method.name, student.name, invoice.name, receipt.name

	def test_balanced_cash_up_when_counted_matches_system(self):
		cashier = self._make_user("cashup-bal@rbac.test", "Bursar")
		payment_method, _student, _invoice, _receipt = self._make_receipt("A", cashier, 100, "2026-02-01")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-01",
			"lines": [{"payment_method": payment_method, "counted_amount": 100}],
		}).insert()

		submit_cash_up(cash_up.name)
		cash_up.reload()
		self.assertEqual(cash_up.workflow_state, "Balanced")
		self.assertEqual(cash_up.lines[0].system_amount, 100)
		self.assertEqual(cash_up.lines[0].variance, 0)

	def test_variance_beyond_threshold_flags_and_locks_cashier(self):
		cashier = self._make_user("cashup-var@rbac.test", "Bursar")
		payment_method, student, invoice, _receipt = self._make_receipt("B", cashier, 100, "2026-02-02")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-02",
			# Threshold defaults to 5; short by 20 -- well over it.
			"lines": [{"payment_method": payment_method, "counted_amount": 80}],
		}).insert()
		submit_cash_up(cash_up.name)
		cash_up.reload()
		self.assertEqual(cash_up.workflow_state, "Variance Flagged")
		self.assertEqual(cash_up.lines[0].variance, -20)

		# Locked out: a fresh Receipt attempt for this cashier must be blocked.
		frappe.set_user(cashier)
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc({
				"doctype": "Receipt", "student": student, "invoice": invoice,
				"payment_method": payment_method, "amount": 10, "posting_date": "2026-02-03",
			}).insert()
		frappe.set_user("Administrator")

	def test_school_head_resolves_and_unlocks(self):
		cashier = self._make_user("cashup-res@rbac.test", "Bursar")
		head = self._make_user("cashup-res-head@rbac.test", "School Head")
		payment_method, _student, _invoice, _receipt = self._make_receipt("C", cashier, 100, "2026-02-04")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-04",
			"lines": [{"payment_method": payment_method, "counted_amount": 50}],
		}).insert()
		submit_cash_up(cash_up.name)

		from edupro_school_fees.edupro_school_fees.doctype.cash_up.cash_up import cashier_is_locked_out
		self.assertTrue(cashier_is_locked_out(cashier))

		frappe.set_user(head)
		resolve_cash_up(cash_up.name, notes="Counted again with the cashier, till roll confirms the shortfall was a data-entry slip.")
		frappe.set_user("Administrator")

		cash_up.reload()
		self.assertEqual(cash_up.workflow_state, "Resolved")
		self.assertEqual(cash_up.reviewed_by, head)
		self.assertFalse(cashier_is_locked_out(cashier))

	def test_only_school_head_can_resolve(self):
		cashier = self._make_user("cashup-onlyhead@rbac.test", "Bursar")
		payment_method, _student, _invoice, _receipt = self._make_receipt("D", cashier, 100, "2026-02-05")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-05",
			"lines": [{"payment_method": payment_method, "counted_amount": 50}],
		}).insert()
		submit_cash_up(cash_up.name)

		frappe.set_user(cashier)
		with self.assertRaises(frappe.PermissionError):
			resolve_cash_up(cash_up.name)
		frappe.set_user("Administrator")

	def test_cannot_submit_someone_elses_cash_up(self):
		cashier = self._make_user("cashup-owner@rbac.test", "Bursar")
		other_bursar = self._make_user("cashup-other@rbac.test", "Bursar")
		payment_method, _student, _invoice, _receipt = self._make_receipt("E", cashier, 100, "2026-02-06")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-06",
			"lines": [{"payment_method": payment_method, "counted_amount": 100}],
		}).insert()

		frappe.set_user(other_bursar)
		with self.assertRaises(frappe.PermissionError):
			submit_cash_up(cash_up.name)
		frappe.set_user("Administrator")

	def test_submitted_cash_up_lines_cannot_be_edited(self):
		cashier = self._make_user("cashup-lock@rbac.test", "Bursar")
		payment_method, _student, _invoice, _receipt = self._make_receipt("F", cashier, 100, "2026-02-07")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-07",
			"lines": [{"payment_method": payment_method, "counted_amount": 100}],
		}).insert()
		submit_cash_up(cash_up.name)

		cash_up.reload()
		cash_up.lines[0].counted_amount = 999
		with self.assertRaises(frappe.ValidationError):
			cash_up.save()

	def test_reversal_request_allowed_even_when_locked_out(self):
		cashier = self._make_user("cashup-revlock@rbac.test", "Bursar")
		payment_method, _student, _invoice, receipt_name = self._make_receipt("G", cashier, 100, "2026-02-08")

		cash_up = frappe.get_doc({
			"doctype": "Cash Up", "cashier": cashier, "cash_up_date": "2026-02-08",
			"lines": [{"payment_method": payment_method, "counted_amount": 50}],
		}).insert()
		submit_cash_up(cash_up.name)

		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import request_receipt_reversal

		frappe.set_user(cashier)
		reversal_name = request_receipt_reversal(receipt_name, "Correcting a mistake, not taking new cash")
		frappe.set_user("Administrator")
		self.assertTrue(frappe.db.exists("Receipt", reversal_name))
