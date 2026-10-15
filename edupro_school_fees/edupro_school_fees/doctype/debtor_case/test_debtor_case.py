"""Debtor Case: outstanding_amount/ageing_bucket are always derived from the
student's own open Invoices, never stored independently."""

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, nowdate

from edupro_school_fees.utils import compute_ageing_bucket, run_debtor_ageing_escalation


class TestDebtorCase(FrappeTestCase):
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

	def _ensure_school_setup(self):
		existing = frappe.db.get_value("School Setup", {}, "name")
		if existing:
			return frappe.get_doc("School Setup", existing)
		return frappe.get_doc({
			"doctype": "School Setup",
			"school_name": "Debtor Case Test School", "registration_number": "DCTEST-001",
			"emis_number": "DCTEST-EMIS-001", "school_code": "DCTEST", "physical_address": "1 Test Road",
			"banking_configuration": [{"bank_name": "Test Bank", "account_name": "Test Account", "account_number": "0000000001"}],
		}).insert()

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account",
				"account_name": account_name,
				"account_type": account_type,
				"currency": "ZiG",
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

	def _make_student_with_overdue_invoice(self, suffix, days_overdue, amount=100):
		debtors = self._ensure_account("Debtors", "Asset")
		income = self._ensure_account("Fees Income", "Income")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": f"DC Test Year {suffix}",
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name"
		)[0]

		category = frappe.get_doc({
			"doctype": "Beneficiary Category",
			"category_name": f"DC Test Category {suffix}",
		}).insert()

		fee_item = frappe.get_doc({
			"doctype": "Fee Item",
			"item_name": f"DC Test Fee Item {suffix}",
			"default_amount": amount,
			"account": income,
		}).insert()

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure",
			"structure_name": f"DC Test Structure {suffix}",
			"academic_year": academic_year.name,
			"term": term_name,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/agm.pdf",
			"mopse_approval_letter": "/files/mopse.pdf",
		}).insert()
		# The workflow only allows Draft -> Pending Approval -> Approved, not a
		# direct jump (including setting the initial value away from Draft on
		# insert) -- go through both hops.
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student",
			"first_name": "DC",
			"last_name": f"Test {suffix}",
			"admission_date": "2026-01-05",
			"academic_year": academic_year.name,
			"beneficiary_category": category.name,
		}).insert()

		due_date = add_days(nowdate(), -days_overdue)
		invoice = frappe.get_doc({
			"doctype": "Invoice",
			"student": student.name,
			"fee_structure": fee_structure.name,
			"posting_date": due_date,
			"due_date": due_date,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()

		return student

	def _add_overdue_invoice(self, student, suffix, days_overdue, amount=100):
		"""A second invoice for an EXISTING student, more/less overdue than
		their first -- refresh_ageing() takes the oldest due date across all
		of a student's open invoices, so this is how these tests simulate a
		case "ageing further" over time. Deliberately a fresh INSERT rather
		than frappe.db.set_value()-mutating an already-submitted invoice's own
		due_date in place: under FrappeTestCase's single shared, uncommitted
		transaction for the whole class, a raw update to an existing row was
		found NOT to be reliably visible to a later frappe.get_all() read in
		this test environment (confirmed live: frappe.db.get_value() on that
		exact row showed the fresh value while frappe.get_all() kept returning
		the pre-update one) -- a fresh row has no such staleness risk."""
		income = self._ensure_account("Fees Income", "Income")
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"DC Test Year {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert()
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name"
		)[0]
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"DC Test Fee Item {suffix}", "default_amount": amount, "account": income,
		}).insert()
		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"DC Test Structure {suffix}",
			"academic_year": academic_year.name, "term": term_name,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/agm.pdf", "mopse_approval_letter": "/files/mopse.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		due_date = add_days(nowdate(), -days_overdue)
		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student, "fee_structure": fee_structure.name,
			"posting_date": due_date, "due_date": due_date,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()
		return invoice

	def test_ageing_bucket_boundaries(self):
		self.assertEqual(compute_ageing_bucket(0), "Current")
		self.assertEqual(compute_ageing_bucket(-5), "Current")
		self.assertEqual(compute_ageing_bucket(30), "1-30 Days")
		self.assertEqual(compute_ageing_bucket(31), "31-60 Days")
		self.assertEqual(compute_ageing_bucket(60), "31-60 Days")
		self.assertEqual(compute_ageing_bucket(61), "61-90 Days")
		self.assertEqual(compute_ageing_bucket(90), "61-90 Days")
		self.assertEqual(compute_ageing_bucket(91), "90+ Days")

	def test_outstanding_amount_and_bucket_derived_from_invoices(self):
		student = self._make_student_with_overdue_invoice("A", days_overdue=45, amount=150)

		case = frappe.get_doc({
			"doctype": "Debtor Case",
			"student": student.name,
		}).insert()

		self.assertEqual(case.outstanding_amount, 150)
		self.assertEqual(case.ageing_bucket, "31-60 Days")
		self.assertEqual(case.workflow_state, "Open")

	def test_payment_plan_creation_moves_case_out_of_open(self):
		student = self._make_student_with_overdue_invoice("B", days_overdue=10, amount=100)
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()
		self.assertEqual(case.workflow_state, "Open")

		frappe.get_doc({
			"doctype": "Payment Plan",
			"debtor_case": case.name,
			"student": student.name,
			"total_amount": 100,
			"start_date": nowdate(),
			"installments": [
				{"due_date": add_days(nowdate(), 30), "amount": 50},
				{"due_date": add_days(nowdate(), 60), "amount": 50},
			],
		}).insert()

		case.reload()
		self.assertEqual(case.workflow_state, "Payment Plan Active")

	def test_payment_plan_installments_must_sum_to_total(self):
		student = self._make_student_with_overdue_invoice("C", days_overdue=10, amount=100)
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Payment Plan",
				"debtor_case": case.name,
				"student": student.name,
				"total_amount": 100,
				"start_date": nowdate(),
				"installments": [{"due_date": add_days(nowdate(), 30), "amount": 40}],
			}).insert()

	def test_get_ageing_summary_excludes_resolved_cases(self):
		from edupro_school_fees.edupro_school_fees.doctype.debtor_case.debtor_case import get_ageing_summary

		open_student = self._make_student_with_overdue_invoice("D", days_overdue=100, amount=200)
		open_case = frappe.get_doc({"doctype": "Debtor Case", "student": open_student.name}).insert()
		self.assertEqual(open_case.ageing_bucket, "90+ Days")

		summary_before = get_ageing_summary()
		outstanding_before = summary_before["90+ Days"]["outstanding_amount"]

		resolved_student = self._make_student_with_overdue_invoice("E", days_overdue=100, amount=999)
		resolved_case = frappe.get_doc({"doctype": "Debtor Case", "student": resolved_student.name}).insert()
		# Resolved now requires a zero balance (see debtor_case.py's validate) --
		# settle the invoice first, same as a real paid-off debt would be.
		frappe.db.set_value("Invoice", {"student": resolved_student.name}, "outstanding_amount", 0)
		resolved_case.reload()
		resolved_case.workflow_state = "Resolved"
		resolved_case.save()

		summary_after = get_ageing_summary()
		# get_ageing_summary() filters out Resolved cases outright.
		self.assertEqual(summary_after["90+ Days"]["outstanding_amount"], outstanding_before)

	def test_get_ageing_summary_blocked_for_non_internal_role(self):
		# DEF-003: this was the one report function in the app with no role
		# check at all -- any authenticated user (Parent/Student included)
		# could call it directly and get school-wide outstanding-debt figures.
		from edupro_school_fees.edupro_school_fees.doctype.debtor_case.debtor_case import get_ageing_summary

		student = self._make_user("dc-ageing-student@rbac.test", "Student")
		frappe.set_user(student)
		with self.assertRaises(frappe.PermissionError):
			get_ageing_summary()

	def test_run_debtor_ageing_escalation_auto_escalates_90_plus(self):
		student = self._make_student_with_overdue_invoice("F", days_overdue=50, amount=100)
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()
		self.assertEqual(case.workflow_state, "Open")

		# Age the case past 90 days without waiting -- a second, more-overdue
		# invoice for the same student, not a mutation of the first (see
		# _add_overdue_invoice's own docstring for why).
		self._add_overdue_invoice(student.name, "F2", days_overdue=100, amount=50)

		run_debtor_ageing_escalation()

		case.reload()
		self.assertEqual(case.ageing_bucket, "90+ Days")
		self.assertEqual(case.workflow_state, "Escalated")

	def test_run_debtor_ageing_escalation_advances_reminder_stage_once(self):
		student = self._make_student_with_overdue_invoice("H", days_overdue=10, amount=100)
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()
		self.assertEqual(case.last_reminder_stage, "None")

		run_debtor_ageing_escalation()
		case.reload()
		self.assertEqual(case.last_reminder_stage, "First")  # default first-reminder threshold is 7 days

		# Running again on the same overdue state must not re-fire the stage.
		run_debtor_ageing_escalation()
		case.reload()
		self.assertEqual(case.last_reminder_stage, "First")

		# Age further via a second, more-overdue invoice -- advances to Second
		# exactly once.
		self._add_overdue_invoice(student.name, "H2", days_overdue=35, amount=50)
		run_debtor_ageing_escalation()
		case.reload()
		self.assertEqual(case.last_reminder_stage, "Second")

	def test_run_debtor_ageing_escalation_honors_configured_escalation_days(self):
		setup = self._ensure_school_setup()
		setup.escalation_days = 30
		setup.save()
		try:
			student = self._make_student_with_overdue_invoice("I", days_overdue=40, amount=100)
			case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

			run_debtor_ageing_escalation()

			case.reload()
			# Under the historical hardcoded 90-day rule, 40 days overdue would
			# NOT have escalated -- the configured 30-day threshold now does.
			self.assertEqual(case.workflow_state, "Escalated")
			self.assertEqual(case.last_reminder_stage, "Escalation")
		finally:
			setup.reload()
			setup.escalation_days = 90
			setup.save()

	def test_cannot_resolve_case_with_outstanding_balance(self):
		student = self._make_student_with_overdue_invoice("RESOLVE-GUARD", days_overdue=10, amount=100)
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

		case.workflow_state = "Resolved"
		with self.assertRaises(frappe.ValidationError):
			case.save()

	def test_run_debtor_ageing_escalation_leaves_resolved_cases_alone(self):
		student = self._make_student_with_overdue_invoice("G", days_overdue=10, amount=100)
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()
		# Resolved now requires a zero balance (see debtor_case.py's validate).
		frappe.db.set_value("Invoice", {"student": student.name}, "outstanding_amount", 0)
		case.workflow_state = "Resolved"
		case.save()

		run_debtor_ageing_escalation()

		case.reload()
		self.assertEqual(case.workflow_state, "Resolved")

	# ------------------------------------------------------------------
	# Payments x Debtors Management test suite (2026-09-24): commissioned to
	# test recording payments and debtors management together, for bugs.
	# outstanding_amount/ageing_bucket/days_overdue are always DERIVED
	# (refresh_ageing(), called from validate()) from the student's open
	# Invoices, never stored independently. Receipt's on_submit hooks include
	# utils.refresh_debtor_cases_for_student (see hooks.py), which re-saves
	# every Debtor Case for that student -- forward payment or reversal --
	# so a case's stored balance never goes stale waiting on the daily
	# scheduler or a user's own save. These tests exercise that end to end,
	# via actual submitted Receipts -- every existing test above settles a
	# balance with frappe.db.set_value() instead, which never exercised this
	# hook at all.
	# ------------------------------------------------------------------

	def _submit_receipt(self, student, invoice, amount, payment_method=None):
		if not payment_method:
			cash = self._ensure_account("DC Test Cash", "Asset")
			payment_method = frappe.get_doc({
				"doctype": "Payment Method", "method_name": "DC Test Cash Method", "account": cash, "currency": "ZiG",
			}).insert(ignore_if_duplicate=True).name
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": amount, "posting_date": nowdate(),
		}).insert()
		receipt.submit()
		return receipt

	def test_full_payment_refreshes_debtor_case_immediately(self):
		student = self._make_student_with_overdue_invoice("PAY1", days_overdue=10, amount=100)
		invoice = frappe.db.get_value("Invoice", {"student": student.name}, "name")
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()
		self.assertEqual(case.outstanding_amount, 100)

		self._submit_receipt(student.name, invoice, 100)

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)

		# No explicit refresh step needed -- Receipt.on_submit's
		# refresh_debtor_cases_for_student hook already re-saved the case.
		case.reload()
		self.assertEqual(case.outstanding_amount, 0)

	def test_resolve_guard_is_safe_even_if_a_case_were_stale(self):
		# Defense in depth: even if something bypassed the on_submit hook and
		# left a case's stored balance stale, the resolve safeguard can't be
		# fooled -- validate() always recomputes fresh, in the same save that
		# checks the guard. Force a stale value directly (not via a normal
		# Receipt, which the hook now keeps fresh) to prove this independently.
		student = self._make_student_with_overdue_invoice("PAY2", days_overdue=10, amount=100)
		invoice = frappe.db.get_value("Invoice", {"student": student.name}, "name")
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

		self._submit_receipt(student.name, invoice, 100)
		frappe.db.set_value("Debtor Case", case.name, "outstanding_amount", 100)

		stale = frappe.get_doc("Debtor Case", case.name)
		self.assertEqual(stale.outstanding_amount, 100)  # confirms it really is stale going in
		stale.workflow_state = "Resolved"
		stale.save()  # must NOT raise -- validate() refreshes first, then the guard sees 0

		stale.reload()
		self.assertEqual(stale.outstanding_amount, 0)
		self.assertEqual(stale.workflow_state, "Resolved")

	def test_partial_payment_correct_immediately(self):
		student = self._make_student_with_overdue_invoice("PAY3", days_overdue=45, amount=100)
		invoice = frappe.db.get_value("Invoice", {"student": student.name}, "name")
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()
		self.assertEqual(case.ageing_bucket, "31-60 Days")

		self._submit_receipt(student.name, invoice, 40)

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 60)

		case.reload()
		self.assertEqual(case.outstanding_amount, 60)
		self.assertEqual(case.ageing_bucket, "31-60 Days")  # unchanged: same invoice, same due date

	def test_overpayment_advance_split_leaves_case_resolvable(self):
		# Combines today's earlier overpayment-cap fix
		# (Receipt._cap_overpayment_into_advance) with debtors management --
		# confirms the two pieces of work don't interact badly. A 150 direct
		# receipt against a 100 balance caps at 100 and auto-splits 50 into a
		# separate Advance receipt; the case should end up cleanly resolvable,
		# not left in some broken/negative state.
		student = self._make_student_with_overdue_invoice("PAY4", days_overdue=10, amount=100)
		invoice = frappe.db.get_value("Invoice", {"student": student.name}, "name")
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

		receipt = self._submit_receipt(student.name, invoice, 150)
		self.assertEqual(receipt.amount, 100)  # capped
		self.assertTrue(receipt.flags.overpayment_advance_receipt)

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)
		self.assertEqual(invoice_doc.status, "Paid")

		case.reload()
		self.assertEqual(case.outstanding_amount, 0)

		case.workflow_state = "Resolved"
		case.save()  # must not raise
		self.assertEqual(case.workflow_state, "Resolved")

	def test_consolidated_invoice_correctly_reflected_in_case_refresh(self):
		# A partially-paid invoice, then a second (more overdue) invoice for
		# the same student -- Invoice._carry_forward_prior_balances() folds
		# the first invoice's remaining balance into the second and zeroes
		# the first (status Consolidated). refresh_ageing() sums open
		# invoices with outstanding_amount > 0, so it should land on exactly
		# the second invoice's total (its own 50 + the carried-forward 70),
		# not double-count the now-Consolidated first invoice.
		student = self._make_student_with_overdue_invoice("PAY5", days_overdue=20, amount=100)
		invoice_a = frappe.db.get_value("Invoice", {"student": student.name}, "name")
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

		self._submit_receipt(student.name, invoice_a, 30)  # leaves 70 on invoice A

		invoice_b = self._add_overdue_invoice(student.name, "PAY5B", days_overdue=25, amount=50)

		invoice_a_doc = frappe.get_doc("Invoice", invoice_a)
		self.assertEqual(invoice_a_doc.outstanding_amount, 0)
		self.assertEqual(invoice_a_doc.status, "Consolidated")
		self.assertEqual(invoice_b.outstanding_amount, 120)  # 50 own + 70 carried forward

		run_debtor_ageing_escalation()
		case.reload()
		self.assertEqual(case.outstanding_amount, 120)  # not 190 (which would double-count invoice A)

	def test_reversed_payment_on_resolved_case_reopens_it_automatically(self):
		# Fixed gap: run_debtor_ageing_escalation() only iterates non-Resolved,
		# non-Legal cases (confirmed in utils.py) -- once a case is Resolved,
		# the scheduler alone would never revisit it. If the receipt that
		# resolved it is later reversed (a bounced payment, a data-entry
		# correction, fraud, etc.), the student's debt is real and overdue
		# again. refresh_debtor_cases_for_student runs on the reversal
		# Receipt's own on_submit (a reversal is just another Receipt
		# submission) and reopens any Resolved case whose recomputed balance
		# comes back above zero -- no scheduler run or manual edit needed.
		student = self._make_student_with_overdue_invoice("PAY6", days_overdue=10, amount=100)
		invoice = frappe.db.get_value("Invoice", {"student": student.name}, "name")
		case = frappe.get_doc({"doctype": "Debtor Case", "student": student.name}).insert()

		bursar = self._make_user("dc-pay6-bursar@rbac.test", "Bursar")
		head = self._make_user("dc-pay6-head@rbac.test", "School Head")

		original = self._submit_receipt(student.name, invoice, 100)
		case.reload()
		case.workflow_state = "Resolved"
		case.save()
		self.assertEqual(case.outstanding_amount, 0)

		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import (
			approve_receipt_reversal,
			request_receipt_reversal,
		)

		frappe.set_user(bursar)
		reversal_name = request_receipt_reversal(original.name, "Test: payment bounced")
		frappe.set_user(head)
		approve_receipt_reversal(reversal_name)
		frappe.set_user("Administrator")

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 100)  # the debt is real again

		# No scheduler run needed -- the reversal's own on_submit hook already
		# reopened the case and refreshed its balance.
		case.reload()
		self.assertEqual(case.workflow_state, "Open")
		self.assertEqual(case.outstanding_amount, 100)
