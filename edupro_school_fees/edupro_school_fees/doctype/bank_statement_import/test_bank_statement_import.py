"""Bank/mobile-money statement import + automated matching (Phase "Billing &
Receipting"). Covers: parsing a real attached CSV, the conservative auto-match
rule (only a reference/description naming exactly one real Invoice at the
exact outstanding amount is auto-matched), manual resolution of anything else,
and that confirm_statement_line() is the only place a real Receipt is ever
posted."""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.edupro_school_fees.doctype.bank_statement_import.bank_statement_import import (
	confirm_statement_line,
	parse_statement,
	set_manual_match,
)


class TestBankStatementImport(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("Bursar", "Fees Approver") if r not in existing]
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
		income = self._ensure_account(f"BSI Test Income {suffix}", "Income")
		cash = self._ensure_account(f"BSI Test Bank {suffix}", "Asset")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"BSI Test Year {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]

		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"BSI Test Cat {suffix}"}).insert(ignore_if_duplicate=True)
		fee_item = frappe.get_doc({"doctype": "Fee Item", "item_name": f"BSI Test Fee {suffix}", "default_amount": amount, "account": income}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"BSI Test Structure {suffix}",
			"academic_year": academic_year.name, "term": term_name,
			"beneficiary_category": category.name,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": f"BSI{suffix}", "last_name": "Test",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()

		payment_method = frappe.get_doc({
			"doctype": "Payment Method", "method_name": f"BSI Test Bank Method {suffix}", "account": cash, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		return student.name, invoice.name, payment_method.name

	def _make_import(self, bank_method, content, suffix):
		# statement_file is mandatory, so the File must exist before the parent
		# Bank Statement Import is even inserted.
		file_doc = frappe.get_doc({
			"doctype": "File", "file_name": f"statement-{suffix}.csv", "is_private": 1, "content": content,
		}).insert(ignore_permissions=True)
		return frappe.get_doc({
			"doctype": "Bank Statement Import", "bank_account": bank_method, "import_date": "2026-01-15",
			"statement_file": file_doc.file_url,
		}).insert()

	def test_parse_auto_matches_exact_invoice_reference(self):
		student, invoice, bank_method = self._make_invoice("AUTO")
		import_doc = self._make_import(
			bank_method, f"date,description,reference,amount\n2026-01-15,Fee payment,{invoice},100\n", "AUTO",
		)

		result = parse_statement(import_doc.name)
		self.assertEqual(result["lines_added"], 1)

		import_doc.reload()
		self.assertEqual(import_doc.lines[0].match_status, "Matched")
		self.assertEqual(import_doc.lines[0].matched_invoice, invoice)
		self.assertEqual(import_doc.lines[0].matched_student, student)

	def test_parse_leaves_unrecognizable_line_for_manual_review(self):
		_student, _invoice, bank_method = self._make_invoice("MANUAL")
		import_doc = self._make_import(
			bank_method, "date,description,reference,amount\n2026-01-15,Unrelated deposit,ABC123,75\n", "MANUAL",
		)

		parse_statement(import_doc.name)
		import_doc.reload()
		self.assertEqual(import_doc.lines[0].match_status, "Manual Review")
		self.assertFalse(import_doc.lines[0].matched_invoice)

	def test_amount_mismatch_falls_back_to_manual_review(self):
		_student, invoice, bank_method = self._make_invoice("MISMATCH")
		# References a real invoice but for the wrong amount -- must not be
		# auto-trusted just because the reference parses.
		import_doc = self._make_import(
			bank_method, f"date,description,reference,amount\n2026-01-15,Fee payment,{invoice},37\n", "MISMATCH",
		)

		parse_statement(import_doc.name)
		import_doc.reload()
		self.assertEqual(import_doc.lines[0].match_status, "Manual Review")

	def test_confirm_matched_line_posts_real_receipt(self):
		student, invoice, bank_method = self._make_invoice("CONFIRM")
		import_doc = self._make_import(
			bank_method, f"date,description,reference,amount\n2026-01-15,Fee payment,{invoice},100\n", "CONFIRM",
		)
		parse_statement(import_doc.name)
		import_doc.reload()
		row_name = import_doc.lines[0].name

		receipt_name = confirm_statement_line(import_doc.name, row_name)
		receipt = frappe.get_doc("Receipt", receipt_name)
		self.assertEqual(receipt.docstatus, 1)
		self.assertEqual(receipt.student, student)
		self.assertEqual(receipt.invoice, invoice)
		self.assertEqual(receipt.external_reference, invoice)

		import_doc.reload()
		self.assertEqual(import_doc.lines[0].match_status, "Posted")
		self.assertEqual(import_doc.status, "Completed")

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)

	def test_manual_match_then_confirm(self):
		student, invoice, bank_method = self._make_invoice("MANCONFIRM")
		import_doc = self._make_import(
			bank_method, "date,description,reference,amount\n2026-01-15,Cash deposit,N/A,100\n", "MANCONFIRM",
		)
		parse_statement(import_doc.name)
		import_doc.reload()
		row_name = import_doc.lines[0].name
		self.assertEqual(import_doc.lines[0].match_status, "Manual Review")

		set_manual_match(import_doc.name, row_name, invoice)
		import_doc.reload()
		self.assertEqual(import_doc.lines[0].match_status, "Matched")
		self.assertEqual(import_doc.lines[0].matched_student, student)

		receipt_name = confirm_statement_line(import_doc.name, row_name)
		self.assertTrue(frappe.db.exists("Receipt", receipt_name))

	def test_cannot_delete_import_with_posted_lines(self):
		_student, invoice, bank_method = self._make_invoice("DEL")
		import_doc = self._make_import(
			bank_method, f"date,description,reference,amount\n2026-01-15,Fee payment,{invoice},100\n", "DEL",
		)
		parse_statement(import_doc.name)
		import_doc.reload()
		confirm_statement_line(import_doc.name, import_doc.lines[0].name)

		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Bank Statement Import", import_doc.name)

	def test_confirm_requires_bursar(self):
		_student, invoice, bank_method = self._make_invoice("PERM")
		import_doc = self._make_import(
			bank_method, f"date,description,reference,amount\n2026-01-15,Fee payment,{invoice},100\n", "PERM",
		)
		parse_statement(import_doc.name)
		import_doc.reload()

		if not frappe.db.exists("User", "bsi-sm-only@rbac.test"):
			frappe.get_doc({
				"doctype": "User", "email": "bsi-sm-only@rbac.test", "first_name": "SMOnly", "send_welcome_email": 0,
				"roles": [{"role": "System Manager"}],
			}).insert(ignore_permissions=True)

		frappe.set_user("bsi-sm-only@rbac.test")
		with self.assertRaises(frappe.PermissionError):
			confirm_statement_line(import_doc.name, import_doc.lines[0].name)
