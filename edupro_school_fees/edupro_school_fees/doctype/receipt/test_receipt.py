"""Receipt carries this system's most compliance-critical requirements --
deletion prohibition, reversal justification, and strict separation of duties
-- and had no dedicated test file before this fix. These tests cover both:

1. The controller's own rules (deletion blocked, reversal needs a reason).
2. The regression this fix closes: a live audit of this exact codebase found
   that a non-Administrator user holding only the System Manager role could
   create and submit a Receipt directly -- something the spec's "Strict
   Separation of Duties" rule (5.2.6) explicitly forbids. System Manager's
   DocPerm on Receipt was write:1/create:1/submit:1/cancel:1; it is now
   read-only, and this test guards against that regressing silently.
"""

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import flt


class TestReceipt(FrappeTestCase):
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

	def _make_invoice(self, suffix, due_date=None, fee_amount=100):
		debtors = "Receipt Test Debtors"
		income = "Receipt Test Income"
		cash = "Receipt Test Cash"
		for account_name, account_type in ((debtors, "Asset"), (income, "Income"), (cash, "Asset")):
			if not frappe.db.exists("Account", account_name):
				frappe.get_doc({
					"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
				}).insert()

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"Receipt Test Year {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]

		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"Receipt Test Cat {suffix}"}).insert(ignore_if_duplicate=True)
		fee_item = frappe.get_doc({"doctype": "Fee Item", "item_name": f"Receipt Test Fee {suffix}", "default_amount": fee_amount, "account": income}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"Receipt Test Structure {suffix}",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": category.name,
			"items": [{"fee_item": fee_item.name, "amount": fee_amount}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		student = frappe.get_doc({
			"doctype": "Student", "first_name": f"Receipt{suffix}", "last_name": "Test",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": "2026-01-10", "due_date": due_date, "items": [{"fee_item": fee_item.name, "amount": fee_amount}],
		}).insert()
		invoice.submit()

		payment_method = frappe.get_doc({
			"doctype": "Payment Method", "method_name": f"Receipt Test Cash Method {suffix}", "account": cash, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		return student.name, invoice.name, payment_method.name

	def test_system_manager_cannot_issue_receipt(self):
		student, invoice, payment_method = self._make_invoice("SM")
		sm_only = self._make_user("receipt-sm-only@rbac.test", "System Manager")

		frappe.set_user(sm_only)
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc({
				"doctype": "Receipt", "student": student, "invoice": invoice,
				"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
			}).insert()

	def test_bursar_can_issue_receipt(self):
		student, invoice, payment_method = self._make_invoice("BUR")
		bursar = self._make_user("receipt-bursar@rbac.test", "Bursar")

		frappe.set_user(bursar)
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()
		self.assertEqual(receipt.status, "Submitted")

	def test_receipt_cannot_be_deleted(self):
		student, invoice, payment_method = self._make_invoice("DEL")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Receipt", receipt.name)

	def test_reversal_requires_reason(self):
		student, invoice, payment_method = self._make_invoice("REV")
		original = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
		}).insert()
		original.submit()

		reversal = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-16",
			"reversal_of": original.name,
		})
		with self.assertRaises(frappe.ValidationError):
			reversal.insert()

	def test_reversal_workflow_end_to_end(self):
		# Full FR-REV-01..05 flow: Bursar requests, School Head approves and
		# submits, the opposite Journal Entry posts, the invoice balance is
		# restored, and the original receipt's status flips to Reversed.
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import (
			approve_receipt_reversal,
			list_pending_reversals,
			request_receipt_reversal,
		)

		student, invoice, payment_method = self._make_invoice("WF")
		bursar = self._make_user("receipt-wf-bursar@rbac.test", "Bursar")
		head = self._make_user("receipt-wf-head@rbac.test", "School Head")

		original = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
		}).insert()
		original.submit()

		invoice_doc = frappe.get_doc("Invoice", invoice)
		outstanding_after_receipt = invoice_doc.outstanding_amount

		frappe.set_user(bursar)
		reversal_name = request_receipt_reversal(original.name, "Test: duplicate payment recorded in error")
		reversal = frappe.get_doc("Receipt", reversal_name)
		self.assertEqual(reversal.docstatus, 0)

		# A Bursar submitting it directly, without approval, must still be blocked.
		with self.assertRaises(frappe.ValidationError):
			reversal.submit()

		pending = list_pending_reversals()
		self.assertIn(reversal_name, [row["name"] for row in pending])

		frappe.set_user(head)
		approve_receipt_reversal(reversal_name)

		reversal.reload()
		self.assertEqual(reversal.docstatus, 1)
		self.assertEqual(reversal.reversal_approved_by, head)

		original.reload()
		self.assertEqual(original.status, "Reversed")

		invoice_doc.reload()
		self.assertEqual(invoice_doc.outstanding_amount, outstanding_after_receipt + 50)

		reversal_je = frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": reversal_name},
			["total_debit", "total_credit"], as_dict=True,
		)
		self.assertEqual(reversal_je.total_debit, 50)
		self.assertEqual(reversal_je.total_credit, 50)

	def test_only_school_head_can_approve_reversal(self):
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import (
			approve_receipt_reversal,
			request_receipt_reversal,
		)

		student, invoice, payment_method = self._make_invoice("APR")
		bursar = self._make_user("receipt-apr-bursar@rbac.test", "Bursar")

		original = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 20, "posting_date": "2026-01-15",
		}).insert()
		original.submit()

		frappe.set_user(bursar)
		reversal_name = request_receipt_reversal(original.name, "Test reason")

		# The same Bursar who requested it cannot also approve it -- they don't
		# hold the School Head role, so this is blocked by role, not identity.
		with self.assertRaises(frappe.PermissionError):
			approve_receipt_reversal(reversal_name)

	def test_cannot_reverse_a_reversal_or_double_reverse(self):
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import (
			approve_receipt_reversal,
			request_receipt_reversal,
		)

		student, invoice, payment_method = self._make_invoice("DBL")
		bursar = self._make_user("receipt-dbl-bursar@rbac.test", "Bursar")
		head = self._make_user("receipt-dbl-head@rbac.test", "School Head")

		original = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 30, "posting_date": "2026-01-15",
		}).insert()
		original.submit()

		frappe.set_user(bursar)
		reversal_name = request_receipt_reversal(original.name, "First reversal")
		frappe.set_user(head)
		approve_receipt_reversal(reversal_name)

		frappe.set_user(bursar)
		with self.assertRaises(frappe.ValidationError):
			request_receipt_reversal(original.name, "Trying to reverse an already-reversed receipt")

		with self.assertRaises(frappe.ValidationError):
			request_receipt_reversal(reversal_name, "Trying to reverse the reversal itself")

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return account_name

	def test_payer_defaults_to_student_guardian(self):
		student, invoice, payment_method = self._make_invoice("PAYDEF")
		guardian = frappe.get_doc({
			"doctype": "Parent Guardian", "full_name": "Default Payer Guardian", "relationship": "Mother",
		}).insert()
		frappe.db.set_value("Student", student, "guardian", guardian.name)

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 40, "posting_date": "2026-01-15",
		}).insert()
		self.assertEqual(receipt.payer_type, "Parent Guardian")
		self.assertEqual(receipt.payer, guardian.name)

	def test_sponsor_can_be_set_as_payer_for_split_billing(self):
		# A sponsor and the family can each pay part of the same invoice -- two
		# Receipts against one Invoice, each with its own payer.
		student, invoice, payment_method = self._make_invoice("SPONSOR")
		sponsor = frappe.get_doc({
			"doctype": "Sponsor", "sponsor_name": "Test Trust SPONSOR", "sponsor_type": "NGO",
		}).insert()

		sponsor_receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 60, "posting_date": "2026-01-15",
			"payer_type": "Sponsor", "payer": sponsor.name,
		}).insert()
		sponsor_receipt.submit()
		self.assertEqual(sponsor_receipt.payer_type, "Sponsor")
		self.assertEqual(sponsor_receipt.payer, sponsor.name)

		family_receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 40, "posting_date": "2026-01-16",
		}).insert()
		family_receipt.submit()
		self.assertEqual(family_receipt.payer_type, "Parent Guardian")

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)
		self.assertEqual(invoice_doc.status, "Paid")

	def test_split_tender_must_sum_to_amount(self):
		student, invoice, payment_method = self._make_invoice("TENDERBAD")
		cash2 = self._ensure_account("Receipt Test Cash2 TENDERBAD", "Asset")
		payment_method2 = frappe.get_doc({
			"doctype": "Payment Method", "method_name": "Receipt Test Cash Method 2 TENDERBAD", "account": cash2, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
			"tender_lines": [
				{"payment_method": payment_method, "amount": 20},
				{"payment_method": payment_method2.name, "amount": 20},
			],
		})
		with self.assertRaises(frappe.ValidationError):
			receipt.insert()

	def test_split_tender_posts_one_je_line_per_tender(self):
		student, invoice, payment_method = self._make_invoice("TENDEROK")
		cash2 = self._ensure_account("Receipt Test Cash2 TENDEROK", "Asset")
		payment_method2 = frappe.get_doc({
			"doctype": "Payment Method", "method_name": "Receipt Test Cash Method 2 TENDEROK", "account": cash2, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 50, "posting_date": "2026-01-15",
			"tender_lines": [
				{"payment_method": payment_method, "amount": 30},
				{"payment_method": payment_method2.name, "amount": 20},
			],
		}).insert()
		receipt.submit()

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		self.assertEqual(len(je.entries), 3)
		self.assertEqual(je.total_debit, 50)
		self.assertEqual(je.total_credit, 50)

	def test_integrity_hash_set_on_submit_and_verify_receipt_detects_tamper(self):
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import verify_receipt

		student, invoice, payment_method = self._make_invoice("HASH")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 25, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()
		receipt.reload()
		self.assertTrue(receipt.integrity_hash)

		result = verify_receipt(receipt.name, token=receipt.integrity_hash)
		self.assertTrue(result["valid"])

		# Simulate a tampered printout: the amount on the live record no longer
		# matches what the hash was computed from at submit time.
		frappe.db.set_value("Receipt", receipt.name, "amount", 9999)
		tampered = verify_receipt(receipt.name, token=receipt.integrity_hash)
		self.assertFalse(tampered["valid"])

	def test_integrity_hash_v2_detects_narration_tamper(self):
		# DEF-024: v1's hash didn't cover payment_method/narration/received_by/
		# tender_lines -- a tampered printout changing those still verified.
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import verify_receipt

		student, invoice, payment_method = self._make_invoice("HASHV2")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 25, "posting_date": "2026-01-15",
			"narration": "Original narration",
		}).insert()
		receipt.submit()
		receipt.reload()
		self.assertGreaterEqual(receipt.integrity_hash_version, 2)

		result = verify_receipt(receipt.name, token=receipt.integrity_hash)
		self.assertTrue(result["valid"])

		frappe.db.set_value("Receipt", receipt.name, "narration", "Tampered narration")
		tampered = verify_receipt(receipt.name, token=receipt.integrity_hash)
		self.assertFalse(tampered["valid"])

	def test_v1_hash_still_verifies_after_v2_formula_added(self):
		# Regression safety: a receipt submitted before this fix (pinned to
		# version 1) must keep verifying correctly forever, even though the
		# current formula (CURRENT_HASH_VERSION) now covers more fields.
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import _compute_receipt_hash, verify_receipt

		student, invoice, payment_method = self._make_invoice("HASHV1")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 25, "posting_date": "2026-01-15",
			"narration": "Some narration a v1 hash never covered",
		}).insert()
		receipt.submit()
		receipt.reload()

		# Force it back to a pre-fix state: hash computed under v1, no version
		# recorded (matching every receipt submitted before this field existed).
		v1_hash = _compute_receipt_hash(receipt, 1)
		frappe.db.set_value("Receipt", receipt.name, {"integrity_hash": v1_hash, "integrity_hash_version": 0})

		result = verify_receipt(receipt.name, token=v1_hash)
		self.assertTrue(result["valid"])

	def test_allocation_type_current_vs_arrears(self):
		student, invoice_current, payment_method = self._make_invoice("ALLOCCUR", due_date="2026-02-01")
		receipt_current = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice_current,
			"payment_method": payment_method, "amount": 10, "posting_date": "2026-01-15",
		}).insert()
		self.assertEqual(receipt_current.allocation_type, "Current")

		student2, invoice_arrears, payment_method2 = self._make_invoice("ALLOCARR", due_date="2026-01-01")
		receipt_arrears = frappe.get_doc({
			"doctype": "Receipt", "student": student2, "invoice": invoice_arrears,
			"payment_method": payment_method2, "amount": 10, "posting_date": "2026-01-20",
		}).insert()
		self.assertEqual(receipt_arrears.allocation_type, "Arrears")

	def test_record_payment_with_allocation_covers_outstanding_then_advance(self):
		# Invoice._carry_forward_prior_balances() (Phase "Onboarding & Records")
		# means a student normally has at most one open outstanding Invoice at a
		# time -- any earlier one gets folded into a new one automatically. So the
		# realistic case for record_payment_with_allocation() is: pay off the
		# single outstanding invoice, with anything left over becoming an Advance.
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import record_payment_with_allocation

		student, invoice, payment_method = self._make_invoice("ALLOC1", due_date="2026-06-01")
		invoice_doc = frappe.get_doc("Invoice", invoice)

		bursar = self._make_user("receipt-alloc-bursar@rbac.test", "Bursar")
		frappe.set_user(bursar)

		payment = flt(invoice_doc.outstanding_amount) + 15
		result = record_payment_with_allocation(
			student=student, amount=payment, payment_method=payment_method, posting_date="2026-01-20",
		)

		self.assertEqual(len(result["receipts"]), 2)
		receipts = [frappe.get_doc("Receipt", name) for name in result["receipts"]]

		invoice_receipt = next(r for r in receipts if r.invoice == invoice)
		self.assertEqual(invoice_receipt.amount, invoice_doc.outstanding_amount)
		self.assertEqual(invoice_receipt.allocation_type, "Current")

		advance_receipt = next(r for r in receipts if not r.invoice)
		self.assertEqual(advance_receipt.amount, 15)
		self.assertEqual(advance_receipt.allocation_type, "Advance")
		self.assertEqual(advance_receipt.advance_remaining, 15)

		invoice_doc.reload()
		self.assertEqual(invoice_doc.outstanding_amount, 0)
		self.assertEqual(invoice_doc.status, "Paid")

	def test_record_payment_with_allocation_requires_bursar(self):
		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import record_payment_with_allocation

		student, invoice, payment_method = self._make_invoice("ALLOCPERM")
		sm_only = self._make_user("receipt-allocperm-sm@rbac.test", "System Manager")

		frappe.set_user(sm_only)
		with self.assertRaises(frappe.PermissionError):
			record_payment_with_allocation(student=student, amount=10, payment_method=payment_method)

	# ------------------------------------------------------------------
	# F-01 regression: a USD Receipt used to credit the (ZiG-tracked)
	# Debtors account with its raw, unconverted dollar figure -- silently
	# treating e.g. 40.50 (USD) as 40.50 ZiG. Confirmed against real
	# production data (16 of 17 submitted Receipts are USD) via an
	# independent audit; root-caused to create_journal_entry_for_receipt
	# never converting through utils._to_base_currency. These tests prove
	# the Debtors leg now carries the correctly *converted* ZiG amount,
	# not the raw native figure, for both a plain USD receipt and a
	# split-tender one mixing USD and ZiG in a single receipt.
	# ------------------------------------------------------------------

	def _make_exchange_rate(self, rate=27.0, effective_date="2026-01-01"):
		existing = frappe.db.exists(
			"Exchange Rate", {"from_currency": "USD", "to_currency": "ZiG", "effective_date": effective_date, "is_active": 1}
		)
		if existing:
			return
		frappe.get_doc({
			"doctype": "Exchange Rate", "from_currency": "USD", "to_currency": "ZiG",
			"exchange_rate": rate, "effective_date": effective_date, "source": "Manual", "is_active": 1,
		}).insert()

	def _make_usd_payment_method(self, suffix):
		cash = f"Receipt Test USD Cash {suffix}"
		if not frappe.db.exists("Account", cash):
			frappe.get_doc({"doctype": "Account", "account_name": cash, "account_type": "Asset", "currency": "USD"}).insert()
		return frappe.get_doc({
			"doctype": "Payment Method", "method_name": f"Receipt Test USD Method {suffix}", "account": cash, "currency": "USD",
		}).insert(ignore_if_duplicate=True).name

	def test_usd_receipt_posts_converted_amount_to_debtors(self):
		self._make_exchange_rate(rate=27.0)
		# fee_amount=2000: comfortably above the 1093.50 ZiG this receipt
		# converts to, so the new overpayment cap (see
		# test_overpayment_on_direct_receipt_creates_advance_for_the_excess)
		# doesn't kick in and mask the conversion figure this test exists
		# to check.
		student, invoice, _ = self._make_invoice("USDCONV", fee_amount=2000)
		usd_method = self._make_usd_payment_method("USDCONV")

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": usd_method, "amount": 40.50, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		# The real shared Debtors account, not the "Receipt Test Debtors"
		# decoy _make_invoice's own fixture creates: create_journal_entry_for_receipt
		# looks up {"account_type": "Asset", "account_name": "Debtors"} by that
		# literal name, matching the one real Debtors account every doctype
		# in this app actually posts to.
		debtors_row = next(r for r in je.entries if r.account == "Debtors")
		cash_row = next(r for r in je.entries if r.account != "Debtors")

		# The bug: this used to be 40.50 (the raw USD figure) instead of
		# 40.50 * 27 = 1093.50 -- exactly the ~1/27x-undervalued Debtors
		# balance the independent audit measured on real production data.
		self.assertEqual(debtors_row.credit, 1093.50)
		self.assertEqual(cash_row.debit, 1093.50)
		self.assertEqual(je.total_debit, je.total_credit)

	def test_zig_receipt_unaffected_by_the_fix(self):
		# Regression guard: a same-currency (ZiG) receipt must still post
		# its plain, unconverted amount -- _to_base_currency short-circuits
		# for an already-base-currency amount, but this proves it end to end.
		student, invoice, payment_method = self._make_invoice("ZIGUNCH")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 40.50, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		debtors_row = next(r for r in je.entries if r.account == "Debtors")
		self.assertEqual(debtors_row.credit, 40.50)

	def test_split_tender_usd_and_zig_receipt_balances_in_zig(self):
		self._make_exchange_rate(rate=27.0)
		# fee_amount=2000: comfortably above the 290 ZiG this receipt
		# converts to (see test_usd_receipt_posts_converted_amount_to_debtors
		# for why this is needed post-overpayment-cap).
		student, invoice, zig_method = self._make_invoice("SPLITCONV", fee_amount=2000)
		usd_method = self._make_usd_payment_method("SPLITCONV")

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": zig_method, "amount": 30, "posting_date": "2026-01-15",
			"tender_lines": [
				{"payment_method": zig_method, "amount": 20},
				{"payment_method": usd_method, "amount": 10},
			],
		}).insert()
		receipt.submit()

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		debtors_row = next(r for r in je.entries if r.account == "Debtors")
		# 20 ZiG (unconverted) + 10 USD * 27 = 270 ZiG -> 290 total, not the
		# raw 30 a pre-fix version would have posted.
		self.assertEqual(debtors_row.credit, 290)
		self.assertEqual(je.total_debit, je.total_credit)

	# ------------------------------------------------------------------
	# Payment-cycle test suite (2026-09-23): commissioned to answer "test
	# recording payments including a student who overpaid, and the full
	# cycle of recording payments and receipting." Covers the everyday
	# path (exact/partial payment), guards the fix for a confirmed gap
	# closed the same day -- direct-receipt overpayment now caps the
	# receipt and auto-creates an Advance receipt for the excess (see
	# Receipt._cap_overpayment_into_advance) -- confirms one suspected gap
	# turned out NOT to be one (Frappe's own link-integrity guard blocks a
	# Receipt cancel while its Journal Entry still exists), and documents
	# the real multi-invoice mechanic (a student can never actually hold 2
	# simultaneously-outstanding invoices under normal invoicing flow).
	#
	# A same-day cross-currency "fix" to Invoice.outstanding_amount was
	# attempted and REVERTED after it corrupted a real production invoice
	# (a genuine $170 receipt against a $510 balance was wrongly zeroed
	# out) -- Invoice has no currency field of its own, and
	# outstanding_amount turned out to be tracked in the school's native
	# fee currency (overwhelmingly USD in practice), not the GL's ZiG. See
	# create_journal_entry_for_receipt's and _cap_overpayment_into_advance's
	# own comments for the corrected reasoning.
	# ------------------------------------------------------------------

	def test_exact_payment_fully_settles_invoice(self):
		student, invoice, payment_method = self._make_invoice("EXACT")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 100, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)
		self.assertEqual(invoice_doc.status, "Paid")

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		self.assertEqual(je.total_debit, 100)
		self.assertEqual(je.total_credit, 100)

	def test_partial_payment_leaves_correct_outstanding_and_status(self):
		student, invoice, payment_method = self._make_invoice("PARTIAL")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 60, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 40)
		self.assertEqual(invoice_doc.status, "Partly Paid")

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		self.assertEqual(je.total_debit, 60)
		self.assertEqual(je.total_credit, 60)

	def test_overpayment_on_direct_receipt_creates_advance_for_the_excess(self):
		# Fixed gap: a Receipt submitted directly against one Invoice, with
		# amount > that invoice's outstanding and no `allocations` table,
		# used to have no cap -- the excess was neither refunded, nor
		# recorded as advance credit, nor flagged anywhere. before_insert()
		# now caps this receipt's own amount at the invoice's outstanding
		# balance and creates+submits a second, independent Advance receipt
		# for the excess, mirroring record_payment_with_allocation()'s own
		# multi-invoice behavior.
		student, invoice, payment_method = self._make_invoice("OVERPAY")
		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 100)

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 150, "posting_date": "2026-01-15",
		}).insert()
		self.assertEqual(receipt.amount, 100)  # capped in place, before submit

		advance_name = receipt.flags.overpayment_advance_receipt
		self.assertTrue(advance_name)
		advance = frappe.get_doc("Receipt", advance_name)
		self.assertEqual(advance.student, student)
		self.assertFalse(advance.invoice)
		# 50 = the 150 originally entered minus the 100 applied above.
		self.assertEqual(advance.amount, 50)
		self.assertEqual(advance.allocation_type, "Advance")
		self.assertEqual(advance.advance_remaining, 50)
		self.assertEqual(advance.docstatus, 1)

		receipt.submit()
		invoice_doc.reload()
		self.assertEqual(invoice_doc.outstanding_amount, 0)
		self.assertEqual(invoice_doc.status, "Paid")

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		debtors_row = next(r for r in je.entries if r.account == "Debtors")
		self.assertEqual(debtors_row.credit, 100)  # the capped amount, not the original 150
		self.assertEqual(je.total_debit, je.total_credit)

	def test_overpayment_on_fully_paid_invoice_is_rejected(self):
		student, invoice, payment_method = self._make_invoice("OVERPAY0")
		frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 100, "posting_date": "2026-01-15",
		}).insert().submit()

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Receipt", "student": student, "invoice": invoice,
				"payment_method": payment_method, "amount": 10, "posting_date": "2026-01-16",
			}).insert()

	def test_split_tender_overpayment_is_rejected_not_prorated(self):
		student, invoice, payment_method = self._make_invoice("TENDEROVER")
		cash2 = self._ensure_account("Receipt Test Cash2 TENDEROVER", "Asset")
		payment_method2 = frappe.get_doc({
			"doctype": "Payment Method", "method_name": "Receipt Test Cash Method 2 TENDEROVER", "account": cash2, "currency": "ZiG",
		}).insert(ignore_if_duplicate=True)

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Receipt", "student": student, "invoice": invoice,
				"payment_method": payment_method, "amount": 150, "posting_date": "2026-01-15",
				"tender_lines": [
					{"payment_method": payment_method, "amount": 100},
					{"payment_method": payment_method2.name, "amount": 50},
				],
			}).insert()

	def test_usd_payment_reduces_invoice_by_its_own_face_value(self):
		# CORRECTION, same day: an earlier version of this test asserted
		# Invoice.outstanding_amount moves by the CONVERTED (ZiG) figure a
		# cross-currency receipt posts to the GL. That was wrong: Invoice
		# has no currency field of its own, and outstanding_amount is a raw
		# sum of Invoice Line amounts in the school's native fee currency
		# (overwhelmingly USD in real production data, not ZiG) -- proven
		# live when a real $170 receipt against a real $510 balance
		# wrongly zeroed it out (170 * 27 = 4590 far exceeds 510). The GL
		# still correctly posts the converted ZiG figure to Debtors (see
		# test_usd_receipt_posts_converted_amount_to_debtors) -- it's only
		# the invoice's own balance that stays in face-value terms.
		self._make_exchange_rate(rate=27.0)
		student, invoice, _ = self._make_invoice("USDCONV2")
		usd_method = self._make_usd_payment_method("USDCONV2")

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": usd_method, "amount": 2, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 98)  # 100 - 2, face value
		self.assertEqual(invoice_doc.status, "Partly Paid")

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		debtors_row = next(r for r in je.entries if r.account == "Debtors")
		self.assertEqual(debtors_row.credit, 54)  # 2 * 27, the GL side still converts

	def test_usd_overpayment_on_direct_receipt_creates_advance_for_the_excess(self):
		# Same fix as test_overpayment_on_direct_receipt_creates_advance_
		# for_the_excess, now via a USD payment method -- proves the
		# cap+advance-split logic compares face-value amounts (150 vs a
		# 100-outstanding invoice), not converted ones (which would have
		# wrongly read this as a much larger overpayment: 150 * 27).
		self._make_exchange_rate(rate=27.0)
		student, invoice, _ = self._make_invoice("USDOVER")
		usd_method = self._make_usd_payment_method("USDOVER")

		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": usd_method, "amount": 150, "posting_date": "2026-01-15",
		}).insert()
		self.assertEqual(receipt.amount, 100)

		advance = frappe.get_doc("Receipt", receipt.flags.overpayment_advance_receipt)
		self.assertEqual(advance.amount, 50)
		self.assertEqual(advance.currency, "USD")
		self.assertEqual(advance.allocation_type, "Advance")

		receipt.submit()
		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)
		self.assertEqual(invoice_doc.status, "Paid")

		je = frappe.get_doc("Journal Entry", frappe.db.get_value(
			"Journal Entry", {"reference_doctype": "Receipt", "reference_name": receipt.name}, "name",
		))
		debtors_row = next(r for r in je.entries if r.account == "Debtors")
		self.assertEqual(debtors_row.credit, 2700)  # the capped 100, still converted for the GL

	def test_usd_reversal_restores_invoice_by_its_own_face_value(self):
		# Same correction as test_usd_payment_reduces_invoice_by_its_own_
		# face_value, confirmed for the reversal branch too.
		self._make_exchange_rate(rate=27.0)
		student, invoice, _ = self._make_invoice("USDREV")
		usd_method = self._make_usd_payment_method("USDREV")
		bursar = self._make_user("receipt-usdrev-bursar@rbac.test", "Bursar")
		head = self._make_user("receipt-usdrev-head@rbac.test", "School Head")

		from edupro_school_fees.edupro_school_fees.doctype.receipt.receipt import (
			approve_receipt_reversal,
			request_receipt_reversal,
		)

		original = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": usd_method, "amount": 2, "posting_date": "2026-01-15",
		}).insert()
		original.submit()

		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 98)  # 100 - 2, face value

		frappe.set_user(bursar)
		reversal_name = request_receipt_reversal(original.name, "Test: wrong amount receipted")
		frappe.set_user(head)
		approve_receipt_reversal(reversal_name)

		invoice_doc.reload()
		self.assertEqual(invoice_doc.outstanding_amount, 100)  # fully restored

	def _make_second_invoice_for_student(self, student, suffix, amount=50):
		income = "Receipt Test Income"
		fee_item = frappe.get_doc({
			"doctype": "Fee Item", "item_name": f"Receipt Test Fee {suffix}", "default_amount": amount, "account": income,
		}).insert(ignore_if_duplicate=True)
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"Receipt Test Year {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.db.get_value("Student", student, "beneficiary_category")
		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"Receipt Test Structure {suffix}",
			"academic_year": academic_year.name, "term": term_name, "beneficiary_category": category,
			"items": [{"fee_item": fee_item.name, "amount": amount}],
			"agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
		}).insert()
		fee_structure.workflow_state = "Pending Approval"
		fee_structure.save()
		self._co_sign_fee_structure(fee_structure)
		fee_structure.workflow_state = "Approved"
		fee_structure.save()

		invoice = frappe.get_doc({
			"doctype": "Invoice", "student": student, "fee_structure": fee_structure.name,
			"posting_date": "2026-02-01", "items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()
		invoice.submit()
		return invoice

	def test_second_invoice_consolidates_first_student_never_has_two_open_invoices(self):
		# Invoice._carry_forward_prior_balances() means a student can never
		# actually accumulate 2+ simultaneously-outstanding invoices under
		# normal invoicing flow -- any new invoice absorbs every prior
		# unpaid, not-yet-consolidated one as a "Balance brought forward"
		# line and zeroes that invoice's own outstanding. Confirms that
		# mechanic directly: "partial payment split across multiple
		# invoices" isn't a reachable state via ordinary invoicing at all --
		# only via record_payment_with_allocation's own internal Advance-
		# receipt split (see
		# test_record_payment_with_allocation_covers_outstanding_then_advance).
		student, invoice_a, payment_method = self._make_invoice("CONSOL")

		frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice_a,
			"payment_method": payment_method, "amount": 30, "posting_date": "2026-01-15",
		}).insert().submit()

		invoice_a_doc = frappe.get_doc("Invoice", invoice_a)
		self.assertEqual(invoice_a_doc.outstanding_amount, 70)

		invoice_b = self._make_second_invoice_for_student(student, "CONSOL-B", amount=50)

		invoice_a_doc.reload()
		self.assertEqual(invoice_a_doc.outstanding_amount, 0)
		self.assertEqual(invoice_a_doc.status, "Consolidated")

		invoice_b.reload()
		self.assertEqual(invoice_b.outstanding_amount, 120)  # 50 own + 70 carried forward
		carried_line = next(r for r in invoice_b.items if "brought forward" in (r.description or "").lower())
		self.assertEqual(carried_line.amount, 70)

	def test_frappe_level_cancel_is_blocked_by_the_linked_journal_entry(self):
		# GOOD, but incidental: Receipt defines on_submit/on_trash but no
		# on_cancel hook of its own, so Frappe's built-in cancel
		# (docstatus 1 -> 2) is a totally separate code path from this
		# app's deliberate reversal workflow (request_receipt_reversal/
		# approve_receipt_reversal) -- no reason required, no School Head
		# approval gate, nothing app-specific stops it. What DOES stop it
		# is Frappe core's own generic "can't cancel a doc another
		# submitted doc still links to" guard (LinkExistsError), because
		# create_journal_entry_for_receipt's Journal Entry references this
		# Receipt. That's a safety net this app gets for free from the
		# framework, not something it built -- worth knowing, since
		# cancelling the Journal Entry FIRST (a separate action, on a
		# separate doctype, with its own separate permissions) would still
		# leave this Receipt Submitted with no audit trail of anything
		# having changed.
		student, invoice, payment_method = self._make_invoice("CANCEL")
		receipt = frappe.get_doc({
			"doctype": "Receipt", "student": student, "invoice": invoice,
			"payment_method": payment_method, "amount": 100, "posting_date": "2026-01-15",
		}).insert()
		receipt.submit()

		with self.assertRaises(frappe.LinkExistsError):
			receipt.cancel()

		# (Not asserting receipt.docstatus here: within one test's DB
		# transaction, cancel()'s in-progress write is visible to a reload
		# even though the exception means a real request would roll the
		# whole thing back -- the meaningful guarantee is the exception
		# itself, and that nothing downstream ever saw a cancelled state.)
		invoice_doc = frappe.get_doc("Invoice", invoice)
		self.assertEqual(invoice_doc.outstanding_amount, 0)
