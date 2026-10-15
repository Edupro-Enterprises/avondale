"""Payment Voucher's real Frappe Workflow (Draft -> Pending SDC Co-Approval ->
Pending School Head Approval -> Approved/Rejected) is the "mandatory
dual-signature rule" the spec names as Phase 6a's whole point -- these tests
exercise the actual sequential approval chain with distinct role-holding
users, not just the controller's own field-fetching logic.
"""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestPaymentVoucher(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self._grant_workflow_roles()

	def _grant_workflow_roles(self):
		# Budget Vote Book Workflow needs School Head to Activate it.
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("School Head",) if r not in existing]
		if missing:
			for role in missing:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)

	def _make_user(self, email, role):
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

	def _make_budget_vote_book(self):
		academic_year = "2026 PV Test Year"
		if not frappe.db.exists("Academic Year", academic_year):
			frappe.get_doc({
				"doctype": "Academic Year",
				"academic_year_name": academic_year,
				"start_date": "2026-01-01",
				"end_date": "2026-12-31",
			}).insert(ignore_permissions=True)

		if frappe.db.exists("Budget Vote Book", academic_year):
			vote_book = frappe.get_doc("Budget Vote Book", academic_year)
		else:
			vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()

		if vote_book.workflow_state != "Active":
			vote_book.workflow_state = "Active"
			vote_book.save()

		return vote_book.name

	def _make_budget_line(self, suffix, fund="Fund A - General/Government", approved_budget=100000):
		vote_book = self._make_budget_vote_book()
		vote_code = f"VOTE-{suffix}"
		name = f"{vote_book}-{vote_code}"
		if frappe.db.exists("Budget Line", name):
			return name

		expense_account = f"PV Test Expense {suffix}"
		if not frappe.db.exists("Account", expense_account):
			frappe.get_doc({
				"doctype": "Account", "account_name": expense_account, "account_type": "Expense", "currency": "ZiG",
			}).insert()

		frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book,
			"vote_code": vote_code,
			"description": f"Test vote {suffix}",
			"fund": fund,
			"expense_account": expense_account,
			"approved_budget": approved_budget,
		}).insert()
		return name

	def _make_vendor(self, name):
		from edupro_school_fees.edupro_school_fees.doctype.vendor.vendor import approve_vendor

		if not frappe.db.exists("Vendor", name):
			frappe.get_doc({"doctype": "Vendor", "vendor_name": name}).insert()
		if frappe.db.get_value("Vendor", name, "approval_status") != "Approved":
			current_user = frappe.session.user
			frappe.set_user(self._make_user("pv-vendor-approver@rbac.test", "School Head"))
			approve_vendor(name)
			frappe.set_user(current_user)
		return name

	def _make_payment_voucher(self, suffix, fund="Fund A - General/Government", amount=100, requested_by=None):
		cash = "PV Test Cash Account"
		if not frappe.db.exists("Account", cash):
			frappe.get_doc({
				"doctype": "Account", "account_name": cash, "account_type": "Asset", "currency": "ZiG",
			}).insert()

		payment_method = f"PV Test Payment Method {suffix}"
		if not frappe.db.exists("Payment Method", payment_method):
			frappe.get_doc({
				"doctype": "Payment Method", "method_name": payment_method, "account": cash, "currency": "ZiG",
			}).insert()

		requisition_fields = {
			"doctype": "Requisition",
			"fund": fund,
			"budget_line": self._make_budget_line(suffix, fund=fund),
			"purpose": f"PV Test {suffix}",
			"posting_date": "2026-03-01",
			"items": [{"description": f"Item {suffix}", "quantity": 1, "estimated_unit_cost": amount}],
			"quotations": [
				{
					"vendor": self._make_vendor(f"Vendor {suffix}{i}"),
					"quoted_amount": amount + i, "currency": "ZiG",
					"quotation_document": f"/files/quote_{suffix}{i}.pdf",
					"is_selected": i == 0,
				}
				for i in range(3)
			],
		}
		if requested_by:
			requisition_fields["requested_by"] = requested_by
		requisition = frappe.get_doc(requisition_fields).insert()

		po = frappe.get_doc({
			"doctype": "Purchase Order",
			"requisition": requisition.name,
			"posting_date": "2026-03-02",
		}).insert()

		return frappe.get_doc({
			"doctype": "Payment Voucher",
			"purchase_order": po.name,
			"payment_method": payment_method,
		}).insert()

	def test_fetches_amount_currency_fund_from_chain(self):
		voucher = self._make_payment_voucher("A", fund="Fund B - SDC/SDA", amount=250)
		self.assertEqual(voucher.amount, 250)
		self.assertEqual(voucher.currency, "ZiG")
		self.assertEqual(voucher.fund, "Fund B - SDC/SDA")
		self.assertEqual(voucher.workflow_state, "Draft")

	def test_full_approval_chain_reaches_approved(self):
		bursar = self._make_user("pv-bursar-b@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-b@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-b@rbac.test", "School Head")

		# Fund B -- SDC is fund-scoped to Fund B/SDC-SDA only, and this test's
		# whole point is exercising their real Co-Approve action.
		voucher = self._make_payment_voucher("B", fund="Fund B - SDC/SDA")

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()

		frappe.set_user(head)
		voucher.reload()
		voucher.workflow_state = "Approved"
		voucher.save()

		self.assertEqual(voucher.workflow_state, "Approved")
		self.assertTrue(voucher.approved_on)

	def test_sdc_can_reject(self):
		bursar = self._make_user("pv-bursar-c@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-c@rbac.test", "SDC Chairperson/Treasurer")

		voucher = self._make_payment_voucher("C", fund="Fund B - SDC/SDA")

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Rejected"
		voucher.save()

		self.assertEqual(voucher.workflow_state, "Rejected")
		self.assertFalse(voucher.approved_on)

	def test_school_head_can_reject(self):
		bursar = self._make_user("pv-bursar-d@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-d@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-d@rbac.test", "School Head")

		voucher = self._make_payment_voucher("D", fund="Fund B - SDC/SDA")

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()

		frappe.set_user(head)
		voucher.reload()
		voucher.workflow_state = "Rejected"
		voucher.save()

		self.assertEqual(voucher.workflow_state, "Rejected")

	def test_direct_draft_to_approved_transition_blocked(self):
		head = self._make_user("pv-head-e@rbac.test", "School Head")
		voucher = self._make_payment_voucher("E")

		frappe.set_user(head)
		voucher.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			voucher.save()

	def test_fund_a_voucher_skips_sdc_and_reaches_approved(self):
		# DEF-001: a Fund A voucher used to land in "Pending SDC Co-Approval" and
		# get stuck there forever, since SDC's own read/write access is fund-
		# scoped to Fund B only -- no role could ever act on it again. The
		# Bursar's "Submit for Approval" action always requests "Pending SDC
		# Co-Approval" (the frontend doesn't know the fund-conditional rule);
		# validate() must redirect a Fund A voucher straight to School Head.
		bursar = self._make_user("pv-bursar-fa@rbac.test", "Bursar")
		head = self._make_user("pv-head-fa@rbac.test", "School Head")

		voucher = self._make_payment_voucher("FA", fund="Fund A - General/Government")

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()
		self.assertEqual(voucher.workflow_state, "Pending School Head Approval")
		self.assertFalse(voucher.co_approved_by)

		frappe.set_user(head)
		voucher.reload()
		voucher.workflow_state = "Approved"
		voucher.save()

		self.assertEqual(voucher.workflow_state, "Approved")
		self.assertTrue(voucher.approved_on)

		frappe.set_user("Administrator")
		payment = frappe.get_doc({
			"doctype": "Cashbook Payment", "payment_voucher": voucher.name, "posting_date": "2026-03-05",
		}).insert()
		payment.submit()
		voucher.reload()
		self.assertTrue(voucher.disbursed)

	def test_fund_b_voucher_still_requires_sdc_co_approval(self):
		# The fix above must not weaken Fund B's real dual-signature rule.
		bursar = self._make_user("pv-bursar-fb@rbac.test", "Bursar")
		head = self._make_user("pv-head-fb@rbac.test", "School Head")

		voucher = self._make_payment_voucher("FB", fund="Fund B - SDC/SDA")

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()
		self.assertEqual(voucher.workflow_state, "Pending SDC Co-Approval")

		# School Head cannot skip straight to Approved without SDC's step.
		frappe.set_user(head)
		voucher.reload()
		voucher.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			voucher.save()

	def test_sdc_fund_scoping_on_payment_voucher(self):
		sdc = self._make_user("pv-sdc-f@rbac.test", "SDC Chairperson/Treasurer")
		fund_a = self._make_payment_voucher("F", fund="Fund A - General/Government")
		fund_b = self._make_payment_voucher("G", fund="Fund B - SDC/SDA")

		frappe.set_user(sdc)
		names = frappe.get_list("Payment Voucher", pluck="name")
		self.assertIn(fund_b.name, names)
		self.assertNotIn(fund_a.name, names)
		self.assertTrue(frappe.has_permission("Payment Voucher", doc=fund_b.name, ptype="read"))
		self.assertFalse(frappe.has_permission("Payment Voucher", doc=fund_a.name, ptype="read"))

	def _approve(self, voucher, bursar, sdc, head):
		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()
		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()
		frappe.set_user(head)
		voucher.reload()
		voucher.workflow_state = "Approved"
		voucher.save()
		frappe.set_user("Administrator")
		voucher.reload()
		return voucher

	def test_cashbook_payment_disburses_approved_voucher_and_updates_budget_line(self):
		bursar = self._make_user("pv-bursar-h@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-h@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-h@rbac.test", "School Head")

		voucher = self._make_payment_voucher("H", fund="Fund B - SDC/SDA", amount=200)
		voucher = self._approve(voucher, bursar, sdc, head)

		budget_line = frappe.get_doc("Budget Line", voucher.budget_line)
		self.assertEqual(budget_line.committed_amount, 200)
		self.assertEqual(budget_line.actual_spend, 0)

		payment = frappe.get_doc({
			"doctype": "Cashbook Payment",
			"payment_voucher": voucher.name,
			"posting_date": "2026-03-05",
		}).insert()
		payment.submit()

		voucher.reload()
		self.assertTrue(voucher.disbursed)

		budget_line.reload()
		self.assertEqual(budget_line.committed_amount, 0)
		self.assertEqual(budget_line.actual_spend, 200)
		self.assertEqual(budget_line.available_balance, budget_line.approved_budget - 200)

		je_name = frappe.db.get_value("Journal Entry", {"reference_doctype": "Cashbook Payment", "reference_name": payment.name}, "name")
		self.assertTrue(je_name)
		je = frappe.get_doc("Journal Entry", je_name)
		self.assertEqual(je.total_debit, 200)
		self.assertEqual(je.total_credit, 200)

	def test_system_manager_cannot_create_cashbook_payment_or_purchase_order(self):
		# DEF-029: System Manager is correctly blocked from Receipt/Journal
		# Entry (no direct ledger posting for the sole Desk-access role), but
		# could previously achieve the same effect indirectly via Cashbook
		# Payment (which posts an identical JE on submit) or unilaterally issue
		# a Purchase Order (which immediately commits a Budget Line).
		system_manager = self._make_user("pv-sysman-t@rbac.test", "System Manager")
		bursar = self._make_user("pv-bursar-t@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-t@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-t@rbac.test", "School Head")

		voucher = self._approve(self._make_payment_voucher("T", fund="Fund B - SDC/SDA"), bursar, sdc, head)

		frappe.set_user(system_manager)
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc({
				"doctype": "Cashbook Payment", "payment_voucher": voucher.name, "posting_date": "2026-03-05",
			}).insert()

		requisition_name = frappe.db.get_value("Purchase Order", voucher.purchase_order, "requisition")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc({
				"doctype": "Purchase Order", "requisition": requisition_name, "posting_date": "2026-03-06",
			}).insert()

	def test_cashbook_payment_blocked_if_voucher_not_approved(self):
		voucher = self._make_payment_voucher("I")
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Cashbook Payment",
				"payment_voucher": voucher.name,
				"posting_date": "2026-03-05",
			}).insert()

	def test_same_person_cannot_be_requisitioner_and_final_approver(self):
		# FR-PV-02: "final approval cannot be the same person as the requisitioner."
		requisitioner = self._make_user("pv-dual-k@rbac.test", "School Head")
		bursar = self._make_user("pv-bursar-k@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-k@rbac.test", "SDC Chairperson/Treasurer")

		voucher = self._make_payment_voucher("K", fund="Fund B - SDC/SDA", requested_by=requisitioner)

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()

		# requisitioner also holds School Head -- must not be able to give final approval.
		frappe.set_user(requisitioner)
		voucher.reload()
		voucher.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			voucher.save()

	def test_same_person_cannot_co_approve_and_then_final_approve(self):
		# The live-tested gap this closes: one person holding two of {SDC
		# Chairperson/Treasurer, School Head} must not be able to execute two of
		# the three approval steps alone.
		bursar = self._make_user("pv-bursar-l@rbac.test", "Bursar")
		dual = self._make_user("pv-dual-l@rbac.test", "SDC Chairperson/Treasurer")
		self._make_user("pv-dual-l@rbac.test", "School Head")

		voucher = self._make_payment_voucher("L", fund="Fund B - SDC/SDA")

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(dual)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()
		self.assertEqual(voucher.co_approved_by, dual)

		frappe.set_user(dual)
		voucher.reload()
		voucher.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			voucher.save()

	def test_cashbook_payment_blocked_if_already_disbursed(self):
		bursar = self._make_user("pv-bursar-j@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-j@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-j@rbac.test", "School Head")

		voucher = self._make_payment_voucher("J", fund="Fund B - SDC/SDA")
		voucher = self._approve(voucher, bursar, sdc, head)

		first = frappe.get_doc({
			"doctype": "Cashbook Payment",
			"payment_voucher": voucher.name,
			"posting_date": "2026-03-05",
		}).insert()
		first.submit()

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Cashbook Payment",
				"payment_voucher": voucher.name,
				"posting_date": "2026-03-06",
			}).insert()

	def test_sensitive_procurement_flagged_by_amount_threshold(self):
		# School Setup's default sensitive_procurement_threshold is 5000.
		below = self._make_payment_voucher("N1", amount=100)
		self.assertFalse(below.is_sensitive_procurement)

		above = self._make_payment_voucher("N2", amount=5000)
		self.assertTrue(above.is_sensitive_procurement)

	def test_sensitive_procurement_blocks_final_approval_without_cosign(self):
		bursar = self._make_user("pv-bursar-o@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-o@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-o@rbac.test", "School Head")

		voucher = self._make_payment_voucher("O", fund="Fund B - SDC/SDA", amount=6000)
		self.assertTrue(voucher.is_sensitive_procurement)

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()

		frappe.set_user(head)
		voucher.reload()
		voucher.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			voucher.save()

	def test_district_auditor_cosign_unblocks_final_approval(self):
		from edupro_school_fees.edupro_school_fees.doctype.payment_voucher.payment_voucher import co_sign_sensitive_procurement

		bursar = self._make_user("pv-bursar-p@rbac.test", "Bursar")
		sdc = self._make_user("pv-sdc-p@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-p@rbac.test", "School Head")
		auditor = self._make_user("pv-auditor-p@rbac.test", "District Education Auditor/Inspector")

		voucher = self._make_payment_voucher("P", fund="Fund B - SDC/SDA", amount=6000)

		frappe.set_user(bursar)
		voucher.workflow_state = "Pending SDC Co-Approval"
		voucher.save()

		frappe.set_user(sdc)
		voucher.reload()
		voucher.workflow_state = "Pending School Head Approval"
		voucher.save()

		frappe.set_user(auditor)
		co_sign_sensitive_procurement(voucher.name)

		frappe.set_user(head)
		voucher.reload()
		self.assertEqual(voucher.sensitive_co_signed_by, auditor)
		voucher.workflow_state = "Approved"
		voucher.save()

		self.assertEqual(voucher.workflow_state, "Approved")

	def test_non_auditor_cannot_cosign_sensitive_procurement(self):
		from edupro_school_fees.edupro_school_fees.doctype.payment_voucher.payment_voucher import co_sign_sensitive_procurement

		bursar = self._make_user("pv-bursar-q@rbac.test", "Bursar")
		voucher = self._make_payment_voucher("Q", amount=6000)

		frappe.set_user(bursar)
		with self.assertRaises(frappe.PermissionError):
			co_sign_sensitive_procurement(voucher.name)

	def test_cannot_cosign_a_non_sensitive_procurement(self):
		from edupro_school_fees.edupro_school_fees.doctype.payment_voucher.payment_voucher import co_sign_sensitive_procurement

		auditor = self._make_user("pv-auditor-r@rbac.test", "District Education Auditor/Inspector")
		voucher = self._make_payment_voucher("R", amount=100)
		self.assertFalse(voucher.is_sensitive_procurement)

		frappe.set_user(auditor)
		with self.assertRaises(frappe.ValidationError):
			co_sign_sensitive_procurement(voucher.name)

	def test_sdc_only_sees_fund_b_journal_entries(self):
		# The GL-leakage gap this closes: SDC's DocPerm on Journal Entry used
		# to be unscoped read access -- they could see Fund A entries (tuition/
		# government) through the raw ledger even though every doctype that
		# *produces* those entries is fund-scoped against them.
		#
		# A Fund A Payment Voucher now skips SDC Co-Approval entirely (see
		# test_fund_a_voucher_skips_sdc_and_reaches_approved), so it never
		# produces a Journal Entry that passes through "Pending SDC
		# Co-Approval" either. Real Fund A entries also come from the fee side
		# (Invoice/Receipt) -- that's what this test exercises, since it's the
		# simplest fixture for a Fund A GL entry.
		from edupro_school_fees.utils import _create_journal_entry

		sdc = self._make_user("pv-sdc-gl-s@rbac.test", "SDC Chairperson/Treasurer")
		head = self._make_user("pv-head-gl-s@rbac.test", "School Head")
		bursar = self._make_user("pv-bursar-gl-s@rbac.test", "Bursar")

		debtors = self._ensure_account("PV Test Fund Debtors", "Asset")
		income = self._ensure_account("PV Test Fund Income", "Income")
		fund_a_je = _create_journal_entry(
			posting_date="2026-03-05", reference_doctype="Invoice", reference_name=None,
			lines=[{"account": debtors, "debit": 50, "credit": 0}, {"account": income, "debit": 0, "credit": 50}],
			remarks="Fund A fixture for GL fund-scoping test",
		).name

		fund_b_voucher = self._approve(self._make_payment_voucher("S2", fund="Fund B - SDC/SDA"), bursar, sdc, head)
		payment = frappe.get_doc({
			"doctype": "Cashbook Payment", "payment_voucher": fund_b_voucher.name, "posting_date": "2026-03-05",
		}).insert()
		payment.submit()
		fund_b_je = frappe.db.get_value("Journal Entry", {"reference_doctype": "Cashbook Payment", "reference_name": payment.name}, "name")

		self.assertEqual(frappe.db.get_value("Journal Entry", fund_a_je, "fund"), "Fund A - General/Government")
		self.assertEqual(frappe.db.get_value("Journal Entry", fund_b_je, "fund"), "Fund B - SDC/SDA")

		frappe.set_user(sdc)
		names = frappe.get_list("Journal Entry", pluck="name")
		self.assertIn(fund_b_je, names)
		self.assertNotIn(fund_a_je, names)
		self.assertTrue(frappe.has_permission("Journal Entry", doc=fund_b_je, ptype="read"))
		self.assertFalse(frappe.has_permission("Journal Entry", doc=fund_a_je, ptype="read"))

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
			}).insert()
		return account_name
