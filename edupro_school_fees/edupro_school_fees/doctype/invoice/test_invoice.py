"""End-to-end smoke test for the Phase 1 fee-collection loop + governance gate.

School/Academic Year/Term -> Beneficiary Category/Fee Item -> Fee Structure
(Draft -> Pending Approval -> Approved, blocked without AGM minutes + MoPSE letter)
-> Student -> Invoice (Dr Debtors / Cr Fees Income) -> Receipt (Dr Bank-Cash /
Cr Debtors), with an Audit Log entry at each step.
"""

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import flt


class TestInvoice(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self._grant_workflow_roles()

	def _grant_workflow_roles(self):
		# The Fee Structure Workflow now genuinely enforces its own transitions
		# (Draft -> Pending Approval needs Bursar, Pending Approval -> Approved
		# needs Fees Approver) -- Administrator has neither role by default.
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
				"doctype": "Account",
				"account_name": account_name,
				"account_type": account_type,
				"currency": "ZiG",
			}).insert()
		return account_name

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

	def test_fee_collection_loop(self):
		debtors = self._ensure_account("Debtors", "Asset")
		income = self._ensure_account("Fees Income", "Income")
		cash = self._ensure_account("Cash-in-Till", "Asset")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": "2026 Test",
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)

		# Academic Year's after_insert hook already auto-generates 3 Terms
		# (term_number 1-3) -- use the first one rather than creating a
		# redundant Term with a colliding term_number.
		term_name = frappe.get_all(
			"Term",
			filters={"academic_year": academic_year.name, "term_number": 1},
			limit=1,
			pluck="name",
		)[0]
		term = frappe.get_doc("Term", term_name)

		category = frappe.get_doc({
			"doctype": "Beneficiary Category",
			"category_name": "Regular Test",
		}).insert(ignore_if_duplicate=True)

		fee_item = frappe.get_doc({
			"doctype": "Fee Item",
			"item_name": "Tuition Test",
			"default_amount": 100,
			"account": income,
		}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure",
			"structure_name": "Test Structure",
			"academic_year": academic_year.name,
			"term": term.name,
			"beneficiary_category": category.name,
			"items": [{"fee_item": fee_item.name, "amount": 100}],
		}).insert()

		# Governance gate: cannot approve without AGM minutes + MoPSE letter.
		fee_structure.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			fee_structure.save()

		fee_structure.reload()
		fee_structure.agm_minutes = "/files/agm_minutes_test.pdf"
		fee_structure.mopse_approval_letter = "/files/mopse_letter_test.pdf"
		# The workflow only allows Draft -> Pending Approval -> Approved, not a
		# direct jump -- go through both hops.
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()
		self.assertEqual(fee_structure.workflow_state, "Approved")
		self.assertTrue(fee_structure.approved_on)

		student = frappe.get_doc({
			"doctype": "Student",
			"first_name": "Test",
			"last_name": "Student",
			"admission_date": "2026-01-05",
			"academic_year": academic_year.name,
			"beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice",
			"student": student.name,
			"fee_structure": fee_structure.name,
			"posting_date": "2026-01-10",
			"items": [{"fee_item": fee_item.name, "amount": 100}],
		}).insert()
		invoice.submit()

		self.assertEqual(invoice.total_amount, 100)
		self.assertEqual(invoice.outstanding_amount, 100)
		invoice_je = frappe.db.exists("Journal Entry", {"reference_doctype": "Invoice", "reference_name": invoice.name})
		self.assertTrue(invoice_je)
		self.assertTrue(frappe.db.exists("Audit Log", {"reference_doctype": "Invoice", "reference_name": invoice.name}))

		payment_method = frappe.get_doc({
			"doctype": "Payment Method",
			"method_name": "Cash Test",
			"account": cash,
			"currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		receipt = frappe.get_doc({
			"doctype": "Receipt",
			"student": student.name,
			"invoice": invoice.name,
			"payment_method": payment_method.name,
			"amount": 100,
			"posting_date": "2026-01-11",
		}).insert()
		receipt.submit()

		invoice.reload()
		self.assertEqual(invoice.outstanding_amount, 0)
		self.assertEqual(invoice.status, "Paid")
		receipt_je = frappe.db.exists("Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name})
		self.assertTrue(receipt_je)
		self.assertTrue(frappe.db.exists("Audit Log", {"reference_doctype": "Receipt", "reference_name": receipt.name}))

		# Receipts are append-only: deletion must be rejected.
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Receipt", receipt.name)

		# A submitted Invoice is part of the ledger trail too: cancelling it must
		# not then allow it to be deleted outright (the "cancel then delete"
		# loophole this fix closes). Two of Frappe's own back-link checks stand
		# in the way of reaching that state at all, and both need to be worked
		# through in the correct order, same as a real Bursar would have to:
		# this invoice already has a Receipt against it (blocks cancelling
		# outright), and every Invoice auto-posts its own Journal Entry on
		# submit (a dynamic link Frappe also refuses to cancel through) -- so a
		# fresh, unpaid invoice needs its own auto-posted Journal Entry
		# cancelled first before the Invoice itself can be cancelled.
		unpaid_invoice = frappe.get_doc({
			"doctype": "Invoice",
			"student": student.name,
			"fee_structure": fee_structure.name,
			"posting_date": "2026-01-12",
			"items": [{"fee_item": fee_item.name, "amount": 100}],
		}).insert()
		unpaid_invoice.submit()

		je_name = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Invoice", "reference_name": unpaid_invoice.name}, "name",
		)
		frappe.get_doc("Journal Entry", je_name).cancel()

		unpaid_invoice.reload()
		unpaid_invoice.cancel()
		self.assertTrue(frappe.db.exists("Audit Log", {"reference_doctype": "Invoice", "reference_name": unpaid_invoice.name, "action": "Invoice Cancelled"}))
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Invoice", unpaid_invoice.name)

		# ...and the Journal Entry we just cancelled is itself still protected
		# by the same "cancel then delete" guard, one level down the chain.
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Journal Entry", je_name)

	def test_invoice_posts_to_each_fee_items_own_income_account(self):
		# DEF-009: create_journal_entry_for_invoice() used to hardcode a single
		# "Fees Income" account for every regular charge, silently ignoring
		# Invoice Line.account (fetched from each Fee Item's own configured
		# income account) -- a school mapping Tuition and Levy to separate
		# income accounts would still see everything land in one account.
		# The debit side always posts to the one account literally named
		# "Debtors" (create_journal_entry_for_invoice()'s debtors_account
		# lookup is intentionally a single fixed account regardless of how
		# many income accounts the credit side splits across) -- DEF-009 only
		# changed which account(s) the credit side posts to.
		debtors = self._ensure_account("Debtors", "Asset")
		tuition_income = self._ensure_account("DEF009 Tuition Income", "Income")
		levy_income = self._ensure_account("DEF009 Levy Income", "Income")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "2026 DEF009 Test",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "DEF009 Test Cat"}).insert(ignore_if_duplicate=True)

		tuition_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "DEF009 Tuition", "default_amount": 150, "account": tuition_income,
		}).insert(ignore_if_duplicate=True)
		levy_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "DEF009 Levy", "default_amount": 50, "account": levy_income,
		}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": "DEF009 Test Structure",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": category.name,
			"items": [{"fee_item": tuition_item.name, "amount": 150}, {"fee_item": levy_item.name, "amount": 50}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "DEF009", "last_name": "Student",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10",
			"items": [{"fee_item": tuition_item.name, "amount": 150}, {"fee_item": levy_item.name, "amount": 50}],
		}).insert()
		invoice.submit()

		je_name = frappe.db.get_value("Journal Entry", {"reference_doctype": "Invoice", "reference_name": invoice.name}, "name")
		je = frappe.get_doc("Journal Entry", je_name)
		by_account = {row.account: (row.debit, row.credit) for row in je.entries}

		self.assertEqual(by_account[debtors], (200, 0))
		self.assertEqual(by_account[tuition_income], (0, 150))
		self.assertEqual(by_account[levy_income], (0, 50))
		self.assertNotIn("Fees Income", by_account)
		self.assertEqual(je.total_debit, 200)
		self.assertEqual(je.total_credit, 200)

	def test_invoice_line_beneficiary_category_can_differ_per_line(self):
		# DEF-008: a single invoice must be able to mix funding sources per
		# line (e.g. a BEAM-funded Tuition line alongside a parent-billed
		# Science Practical line), not just one category for the whole
		# structure/invoice.
		income = self._ensure_account("DEF008 Income", "Income")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "2026 DEF008 Test",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]

		default_category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "DEF008 Parent"}).insert(ignore_if_duplicate=True)
		beam_category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "DEF008 BEAM"}).insert(ignore_if_duplicate=True)

		tuition_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "DEF008 Tuition", "default_amount": 150, "account": income,
		}).insert(ignore_if_duplicate=True)
		practical_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "DEF008 Practical", "default_amount": 25, "account": income,
		}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": "DEF008 Test Structure",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": default_category.name,
			"items": [
				{"fee_item": tuition_item.name, "amount": 150, "beneficiary_category": beam_category.name},
				{"fee_item": practical_item.name, "amount": 25},
			],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "DEF008", "last_name": "Student",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": default_category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10",
			"items": [{"fee_item": tuition_item.name, "amount": 150}, {"fee_item": practical_item.name, "amount": 25}],
		}).insert()

		by_item = {row.fee_item: row.beneficiary_category for row in invoice.items}
		self.assertEqual(by_item[tuition_item.name], beam_category.name)
		self.assertEqual(by_item[practical_item.name], default_category.name)

	def _make_approved_batch_fee_structure(self, suffix, income, amount=200):
		# run_batch_invoicing() deliberately calls frappe.db.commit() after each
		# student it invoices (so one student's failure can't roll back students
		# already successfully invoiced earlier in the same real production run)
		# -- but that also commits everything else in the current transaction,
		# including these test fixtures, past FrappeTestCase's usual end-of-test
		# rollback. Re-running the suite against the same persistent site
		# (this project has no separate throwaway test database) would then
		# collide with fixtures a previous run already made permanent, so every
		# call gets its own fresh, never-repeated suffix rather than a fixed one.
		suffix = f"{suffix}-{frappe.generate_hash(length=6)}"
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"2026 Batch Test {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		term = frappe.get_doc("Term", term_name)

		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"Batch Test Cat {suffix}"}).insert(ignore_if_duplicate=True)
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"Batch Test Tuition {suffix}", "default_amount": amount, "account": income,
		}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"Batch Test Structure {suffix}",
			"academic_year": academic_year.name, "term": term.name, "beneficiary_category": category.name,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()
		return fee_structure, term, category

	def test_batch_invoicing(self):
		from edupro_school_fees.edupro_school_fees.doctype.invoice.invoice import run_batch_invoicing

		income = self._ensure_account("Batch Test Income", "Income")
		fee_structure, term, category = self._make_approved_batch_fee_structure("A", income, amount=200)
		other_category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "Batch Test Cat A Other"}).insert(ignore_if_duplicate=True)

		# Admitted well before the term started -> billed in full.
		full_term_student = frappe.get_doc({
			"doctype": "Student", "first_name": "Batch", "last_name": "Full",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name, "grade": "Form 2A",
		}).insert()

		# Admitted at the term's midpoint -> pro-rated to roughly half.
		midpoint = frappe.utils.add_days(term.start_date, frappe.utils.date_diff(term.end_date, term.start_date) // 2)
		mid_term_student = frappe.get_doc({
			"doctype": "Student", "first_name": "Batch", "last_name": "Mid",
			"admission_date": midpoint, "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name, "grade": "Form 2A",
		}).insert()

		# Different beneficiary category -> this Fee Structure isn't theirs, must not be swept in.
		other_category_student = frappe.get_doc({
			"doctype": "Student", "first_name": "Batch", "last_name": "Other",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": other_category.name,
		}).insert()

		# Withdrawn -> must never be invoiced.
		withdrawn_student = frappe.get_doc({
			"doctype": "Student", "first_name": "Batch", "last_name": "Withdrawn",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name, "status": "Withdrawn",
		}).insert()

		result = run_batch_invoicing(fee_structure.name)
		self.assertEqual({c["invoice"] for c in result["created"]}, {
			frappe.db.get_value("Invoice", {"student": full_term_student.name}, "name"),
			frappe.db.get_value("Invoice", {"student": mid_term_student.name}, "name"),
		})
		self.assertEqual({c["student"] for c in result["created"]}, {full_term_student.name, mid_term_student.name})
		self.assertEqual(result["failed"], [])

		full_invoice = frappe.get_doc("Invoice", {"student": full_term_student.name, "fee_structure": fee_structure.name})
		self.assertEqual(full_invoice.total_amount, 200)
		self.assertEqual(full_invoice.docstatus, 1)

		mid_invoice = frappe.get_doc("Invoice", {"student": mid_term_student.name, "fee_structure": fee_structure.name})
		self.assertLess(mid_invoice.total_amount, 200)
		self.assertGreater(mid_invoice.total_amount, 0)

		self.assertFalse(frappe.db.exists("Invoice", {"student": other_category_student.name, "fee_structure": fee_structure.name}))
		self.assertFalse(frappe.db.exists("Invoice", {"student": withdrawn_student.name, "fee_structure": fee_structure.name}))

		# Re-running must skip everyone already invoiced, never double-bill them.
		second_run = run_batch_invoicing(fee_structure.name)
		self.assertEqual(second_run["created"], [])
		self.assertEqual(set(second_run["skipped_existing"]), {full_term_student.name, mid_term_student.name})

	def test_batch_invoicing_grade_filter(self):
		from edupro_school_fees.edupro_school_fees.doctype.invoice.invoice import run_batch_invoicing

		income = self._ensure_account("Batch Test Income B", "Income")
		fee_structure, _term, category = self._make_approved_batch_fee_structure("B", income)

		form2 = frappe.get_doc({
			"doctype": "Student", "first_name": "Batch", "last_name": "Form2",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name, "grade": "Form 2A",
		}).insert()
		form3 = frappe.get_doc({
			"doctype": "Student", "first_name": "Batch", "last_name": "Form3",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name, "grade": "Form 3B",
		}).insert()

		result = run_batch_invoicing(fee_structure.name, grade="Form 2A")
		self.assertTrue(frappe.db.exists("Invoice", {"student": form2.name, "fee_structure": fee_structure.name}))
		self.assertFalse(frappe.db.exists("Invoice", {"student": form3.name, "fee_structure": fee_structure.name}))
		self.assertEqual(len(result["created"]), 1)

	def test_batch_invoicing_requires_bursar_role(self):
		from edupro_school_fees.edupro_school_fees.doctype.invoice.invoice import run_batch_invoicing

		income = self._ensure_account("Batch Test Income C", "Income")
		fee_structure, _term, _category = self._make_approved_batch_fee_structure("C", income)
		auditor = self._make_user("batch-inv-auditor@rbac.test", "District Education Auditor/Inspector")

		frappe.set_user(auditor)
		with self.assertRaises(frappe.PermissionError):
			run_batch_invoicing(fee_structure.name)

	def test_batch_invoicing_requires_approved_fee_structure(self):
		from edupro_school_fees.edupro_school_fees.doctype.invoice.invoice import run_batch_invoicing

		income = self._ensure_account("Batch Test Income D", "Income")
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "2026 Batch Test D",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": "Batch Test Tuition D", "default_amount": 100, "account": income,
		}).insert(ignore_if_duplicate=True)
		draft_fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": "Batch Test Structure D",
			"academic_year": academic_year.name, "term": term_name,
			"items": [{"fee_item": fee_item.name, "amount": 100}],
		}).insert()

		with self.assertRaises(frappe.ValidationError):
			run_batch_invoicing(draft_fee_structure.name)

	def test_prior_balance_carried_forward_onto_new_invoice(self):
		# FR-FEE-08: a student's leftover balance from an earlier invoice is
		# automatically added to their next one, and the old invoice is marked
		# Consolidated rather than sitting there as a second thing to chase.
		income = self._ensure_account("Carry Forward Test Income", "Income")
		fee_structure_1, _term1, category = self._make_approved_batch_fee_structure("CF1", income, amount=150)

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "CarryForward", "last_name": "Test",
			"admission_date": "2025-01-01", "academic_year": fee_structure_1.academic_year,
			"beneficiary_category": category.name,
		}).insert()

		invoice1 = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure_1.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_structure_1.items[0].fee_item, "amount": 150}],
		}).insert()
		invoice1.submit()

		cash = self._ensure_account("Carry Forward Test Cash", "Asset")
		payment_method = frappe.get_doc({
			"doctype": "Payment Method", "method_name": "Carry Forward Test Cash Method", "account": cash, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student.name, "invoice": invoice1.name,
			"payment_method": payment_method.name, "amount": 50, "posting_date": "2026-01-11",
		}).insert()
		receipt.submit()

		invoice1.reload()
		self.assertEqual(invoice1.outstanding_amount, 100)

		fee_structure_2, _term2, _category2 = self._make_approved_batch_fee_structure("CF2", income, amount=200)
		invoice2 = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure_2.name,
			"posting_date": "2026-04-10", "items": [{"fee_item": fee_structure_2.items[0].fee_item, "amount": 200}],
		}).insert()

		brought_forward = [row for row in invoice2.items if row.is_brought_forward]
		self.assertEqual(len(brought_forward), 1)
		self.assertEqual(brought_forward[0].amount, 100)
		self.assertEqual(invoice2.total_amount, 300)

		invoice2.submit()

		invoice1.reload()
		self.assertEqual(invoice1.status, "Consolidated")
		self.assertEqual(invoice1.outstanding_amount, 0)

		# The GL must not double-count the 100 already recognized as income
		# when invoice1 itself was submitted.
		je2 = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Invoice", "reference_name": invoice2.name},
			["total_debit", "total_credit"], as_dict=True,
		)
		self.assertEqual(je2.total_debit, 200)
		self.assertEqual(je2.total_credit, 200)

	def test_no_brought_forward_line_when_nothing_outstanding(self):
		income = self._ensure_account("Carry Forward Test Income B", "Income")
		fee_structure, _term, category = self._make_approved_batch_fee_structure("CF3", income, amount=100)
		student = frappe.get_doc({
			"doctype": "Student", "first_name": "NoPriorDebt", "last_name": "Test",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_structure.items[0].fee_item, "amount": 100}],
		}).insert()
		self.assertEqual(len(invoice.items), 1)
		self.assertFalse(any(row.is_brought_forward for row in invoice.items))

	def test_advance_payment_applied_to_next_invoice(self):
		# A payment with no invoice attached (an Advance) sits unapplied until a
		# later Invoice consumes it via Invoice._apply_available_advance() -- that
		# invoice's JE still recognizes the full new charge as Income, but
		# releases the advance from Unearned Revenue rather than debiting Debtors
		# for the portion already paid.
		debtors = self._ensure_account("Debtors", "Asset")
		income = self._ensure_account("Fees Income", "Income")
		cash = self._ensure_account("Advance Test Cash", "Asset")
		unearned = self._ensure_account("Unearned Revenue", "Liability")

		fee_structure, _term, category = self._make_approved_batch_fee_structure("ADV1", income, amount=200)
		student = frappe.get_doc({
			"doctype": "Student", "first_name": "Advance", "last_name": "Test",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name,
		}).insert()

		payment_method = frappe.get_doc({
			"doctype": "Payment Method", "method_name": "Advance Test Cash Method", "account": cash, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		advance = frappe.get_doc({
			"doctype": "Receipt", "student": student.name, "payment_method": payment_method.name,
			"amount": 50, "posting_date": "2026-01-05",
		}).insert()
		self.assertEqual(advance.allocation_type, "Advance")
		advance.submit()

		advance_je_name = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": advance.name}, "name",
		)
		advance_je = frappe.db.get_value("Journal Entry", advance_je_name, ["total_debit", "total_credit"], as_dict=True)
		self.assertEqual(advance_je.total_debit, 50)
		self.assertEqual(advance_je.total_credit, 50)
		unearned_credit = frappe.db.get_value(
			"Journal Entry Account", {"parent": advance_je_name, "account": unearned}, "credit",
		)
		self.assertEqual(unearned_credit, 50)

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "items": [{"fee_item": fee_structure.items[0].fee_item, "amount": 200}],
		}).insert()

		applied = [row for row in invoice.items if row.is_advance_applied]
		self.assertEqual(len(applied), 1)
		self.assertEqual(applied[0].amount, -50)
		self.assertEqual(invoice.total_amount, 150)
		self.assertEqual(invoice.outstanding_amount, 150)

		invoice.submit()

		advance.reload()
		self.assertEqual(advance.advance_remaining, 0)

		invoice_je = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Invoice", "reference_name": invoice.name},
			["name", "total_debit", "total_credit"], as_dict=True,
		)
		# Dr Debtors 200 / Cr Income 200 / Dr Unearned Revenue 50 / Cr Debtors 50
		self.assertEqual(invoice_je.total_debit, 250)
		self.assertEqual(invoice_je.total_credit, 250)

		debtors_net = frappe.db.sql(
			"select sum(debit) - sum(credit) from `tabJournal Entry Account` where parent = %s and account = %s",
			(invoice_je.name, debtors),
		)[0][0]
		self.assertEqual(flt(debtors_net), 150)

	def test_balance_sheet_is_balanced_after_ordinary_activity(self):
		# The real check this closes: get_financial_position() used to compute
		# accumulated_funds as a pure plug (Assets - Liabilities), which could
		# never fail to balance regardless of what the ledger said. is_balanced
		# now asserts the actual accounting identity (Assets = Liabilities +
		# Equity + unclosed Income-Expense) against real Journal Entry data.
		from edupro_school_fees.reports import get_financial_position

		income = self._ensure_account("Balance Sheet Test Income", "Income")
		fee_structure, _term, category = self._make_approved_batch_fee_structure("BAL1", income, amount=180)
		student = frappe.get_doc({
			"doctype": "Student", "first_name": "BalanceSheet", "last_name": "Test",
			"admission_date": "2025-01-01", "academic_year": fee_structure.academic_year,
			"beneficiary_category": category.name,
		}).insert()

		# 2026-09 is clear of every other test file's hardcoded report-window
		# dates (test_journal_entry_reports.py's own income/receipts tests use
		# Jan/Apr/May/Jun 2026 with exact-total assertions against the same
		# global, unscoped-by-test reports.py queries) -- picking a date those
		# tests don't touch avoids inflating their expected totals.
		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-09-10", "items": [{"fee_item": fee_structure.items[0].fee_item, "amount": 180}],
		}).insert()
		invoice.submit()

		result = get_financial_position("2026-09-10")
		self.assertTrue(result["is_balanced"], f"Balance sheet imbalance: {result['imbalance_amount']}")
		self.assertEqual(result["imbalance_amount"], 0)

	# ------------------------------------------------------------------
	# F-01 regression, invoice side: a USD-denominated Fee Item's amount
	# used to post to the GL raw and unconverted, combined as if it were
	# ZiG with any ZiG-denominated lines on the same Invoice. These prove
	# each line is now converted through its own Fee Item's currency
	# before being summed into the Debtors debit / per-account credits.
	# ------------------------------------------------------------------

	def test_invoice_with_mixed_currency_lines_converts_each_line(self):
		if not frappe.db.exists(
			"Exchange Rate", {"from_currency": "USD", "to_currency": "ZiG", "effective_date": "2026-11-01", "is_active": 1}
		):
			frappe.get_doc({
				"doctype": "Exchange Rate", "from_currency": "USD", "to_currency": "ZiG",
				"exchange_rate": 27.0, "effective_date": "2026-11-01", "source": "Manual", "is_active": 1,
			}).insert()

		suffix = f"MIXCUR-{frappe.generate_hash(length=6)}"
		income = self._ensure_account(f"Mixed Currency Income {suffix}", "Income")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"2026 {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"Cat {suffix}"}).insert(ignore_if_duplicate=True)

		zig_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"Tuition ZiG {suffix}", "default_amount": 100,
			"currency": "ZiG", "account": income,
		}).insert()
		usd_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"Tuition USD {suffix}", "default_amount": 20,
			"currency": "USD", "account": income,
		}).insert()

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"Structure {suffix}",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": category.name,
			"items": [{"fee_item": zig_item.name, "amount": 100}, {"fee_item": usd_item.name, "amount": 20}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": "MixedCurrency", "last_name": "Test",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-11-05",
			"items": [{"fee_item": zig_item.name, "amount": 100}, {"fee_item": usd_item.name, "amount": 20}],
		}).insert()
		invoice.submit()

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Invoice", "reference_name": invoice.name}, "name",
		))
		debtors_row = next(r for r in je.entries if r.account != income)
		income_row = next(r for r in je.entries if r.account == income)

		# 100 ZiG (unconverted) + 20 USD * 27 = 540 -> 640 total, not the
		# raw 120 a pre-fix version would have posted.
		self.assertEqual(debtors_row.debit, 640)
		self.assertEqual(income_row.credit, 640)
		self.assertEqual(je.total_debit, je.total_credit)

		# Invoice.total_amount itself is a separate, deliberately-untouched
		# concern (see create_journal_entry_for_invoice's docstring) -- it
		# still tracks the raw, native-per-line sum used for the invoice's
		# own outstanding-balance bookkeeping, not the GL posting.
		invoice.reload()
		self.assertEqual(invoice.total_amount, 120)
