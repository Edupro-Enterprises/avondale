import frappe
from frappe.tests.utils import FrappeTestCase


class TestRequisition(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self._grant_workflow_roles()

	def _grant_workflow_roles(self):
		# Budget Vote Book Workflow needs School Head to Activate it -- Administrator
		# has neither that nor Bursar by default.
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("Bursar", "School Head") if r not in existing]
		if missing:
			for role in missing:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)

	def _make_budget_vote_book(self):
		academic_year = "2026 Requisition Test Year"
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

		expense_account = f"Requisition Test Expense {suffix}"
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

	def _ensure_school_setup(self):
		existing = frappe.db.get_value("School Setup", {}, "name")
		if existing:
			return frappe.get_doc("School Setup", existing)
		return frappe.get_doc({
			"doctype": "School Setup",
			"school_name": "Requisition Test School", "registration_number": "REQTEST-001",
			"emis_number": "REQTEST-EMIS-001", "school_code": "REQTEST", "physical_address": "1 Test Road",
			"banking_configuration": [{"bank_name": "Test Bank", "account_name": "Test Account", "account_number": "0000000001"}],
		}).insert()

	def _make_vendor(self, name, approved=True):
		from edupro_school_fees.edupro_school_fees.doctype.vendor.vendor import approve_vendor

		if not frappe.db.exists("Vendor", name):
			frappe.get_doc({"doctype": "Vendor", "vendor_name": name}).insert()
		if approved and frappe.db.get_value("Vendor", name, "approval_status") != "Approved":
			head = self._make_user("req-vendor-approver@rbac.test", "School Head")
			current_user = frappe.session.user
			frappe.set_user(head)
			approve_vendor(name)
			frappe.set_user(current_user)
		return name

	def _make_requisition(self, suffix, fund="Fund A - General/Government", n_quotations=3, n_selected=1, budget_line=None, approved_vendors=True):
		requisition = frappe.get_doc({
			"doctype": "Requisition",
			"fund": fund,
			"budget_line": budget_line or self._make_budget_line(suffix, fund=fund),
			"purpose": f"Requisition Test {suffix}",
			"posting_date": "2026-03-01",
			"items": [{
				"description": f"Item {suffix}",
				"quantity": 2,
				"estimated_unit_cost": 50,
			}],
			"quotations": [
				{
					"vendor": self._make_vendor(f"Vendor {suffix}{i}", approved=approved_vendors),
					"quoted_amount": 100 + i,
					"currency": "ZiG",
					"quotation_document": f"/files/quote_{suffix}{i}.pdf",
					"is_selected": 1 if i < n_selected else 0,
				}
				for i in range(n_quotations)
			],
		}).insert()
		return requisition

	def test_total_estimated_amount_computed_from_items(self):
		requisition = self._make_requisition("A")
		self.assertEqual(requisition.total_estimated_amount, 100)  # 2 * 50
		self.assertEqual(requisition.items[0].estimated_amount, 100)

	def test_purchase_order_requires_at_least_three_quotations(self):
		requisition = self._make_requisition("B", n_quotations=2)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order",
				"requisition": requisition.name,
				"posting_date": "2026-03-02",
			}).insert()

	def test_purchase_order_requires_exactly_one_selected_quotation(self):
		requisition = self._make_requisition("C", n_quotations=3, n_selected=0)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order",
				"requisition": requisition.name,
				"posting_date": "2026-03-02",
			}).insert()

		requisition_two_selected = self._make_requisition("C2", n_quotations=3, n_selected=2)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order",
				"requisition": requisition_two_selected.name,
				"posting_date": "2026-03-02",
			}).insert()

	def test_purchase_order_pulls_selected_quotation_and_closes_requisition(self):
		requisition = self._make_requisition("D")
		po = frappe.get_doc({
			"doctype": "Purchase Order",
			"requisition": requisition.name,
			"posting_date": "2026-03-02",
		}).insert()

		self.assertEqual(po.vendor_name, "Vendor D0")
		self.assertEqual(po.amount, 100)
		self.assertEqual(po.currency, "ZiG")

		requisition.reload()
		self.assertEqual(requisition.status, "Closed")

	def test_second_purchase_order_against_closed_requisition_fails(self):
		requisition = self._make_requisition("E")
		frappe.get_doc({
			"doctype": "Purchase Order",
			"requisition": requisition.name,
			"posting_date": "2026-03-02",
		}).insert()

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order",
				"requisition": requisition.name,
				"posting_date": "2026-03-03",
			}).insert()

	def test_sdc_sees_only_fund_b_requisitions(self):
		sdc = self._make_user("req-sdc-f@rbac.test", "SDC Chairperson/Treasurer")
		fund_a = self._make_requisition("F", fund="Fund A - General/Government")
		fund_b = self._make_requisition("G", fund="Fund B - SDC/SDA")

		frappe.set_user(sdc)
		names = frappe.get_list("Requisition", pluck="name")
		self.assertIn(fund_b.name, names)
		self.assertNotIn(fund_a.name, names)
		self.assertTrue(frappe.has_permission("Requisition", doc=fund_b.name, ptype="read"))
		self.assertFalse(frappe.has_permission("Requisition", doc=fund_a.name, ptype="read"))

	def test_bursar_sees_both_funds(self):
		bursar = self._make_user("req-bursar-h@rbac.test", "Bursar")
		fund_a = self._make_requisition("H", fund="Fund A - General/Government")
		fund_b = self._make_requisition("I", fund="Fund B - SDC/SDA")

		frappe.set_user(bursar)
		names = frappe.get_list("Requisition", pluck="name")
		self.assertIn(fund_a.name, names)
		self.assertIn(fund_b.name, names)

	def test_budget_line_fund_mismatch_rejected(self):
		budget_line = self._make_budget_line("J", fund="Fund B - SDC/SDA")
		with self.assertRaises(frappe.ValidationError):
			self._make_requisition("J", fund="Fund A - General/Government", budget_line=budget_line)

	def test_requisition_blocked_against_closed_vote_book(self):
		# A dedicated, single-use Academic Year/Budget Vote Book -- this test closes it,
		# and the shared "2026 Requisition Test Year" fixture used by every other test
		# in this class must never be left in a non-Active state.
		academic_year = "2026 Requisition Test Year Closed"
		frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": academic_year,
			"start_date": "2026-01-01",
			"end_date": "2026-12-31",
		}).insert()
		vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year}).insert()
		vote_book.workflow_state = "Active"
		vote_book.save()

		expense_account = "Requisition Test Expense K"
		if not frappe.db.exists("Account", expense_account):
			frappe.get_doc({
				"doctype": "Account", "account_name": expense_account, "account_type": "Expense", "currency": "ZiG",
			}).insert()
		budget_line = frappe.get_doc({
			"doctype": "Budget Line",
			"budget_vote_book": vote_book.name,
			"vote_code": "VOTE-K",
			"description": "Test vote K",
			"fund": "Fund A - General/Government",
			"expense_account": expense_account,
			"approved_budget": 100000,
		}).insert()

		vote_book.reload()
		vote_book.workflow_state = "Closed"
		vote_book.save()

		with self.assertRaises(frappe.ValidationError):
			self._make_requisition("K", budget_line=budget_line.name)

	def test_purchase_order_commits_against_budget_line_and_blocks_overspend(self):
		budget_line_name = self._make_budget_line("L", approved_budget=150)
		requisition = self._make_requisition("L", budget_line=budget_line_name)  # amount will be 100

		po = frappe.get_doc({
			"doctype": "Purchase Order",
			"requisition": requisition.name,
			"posting_date": "2026-03-02",
		}).insert()

		budget_line = frappe.get_doc("Budget Line", budget_line_name)
		self.assertEqual(budget_line.committed_amount, po.amount)
		self.assertEqual(budget_line.available_balance, 150 - po.amount)

		# A second requisition against the same (now nearly-depleted) vote, requesting
		# more than what remains, must be blocked at Purchase Order stage.
		requisition_two = self._make_requisition("L2", budget_line=budget_line_name)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order",
				"requisition": requisition_two.name,
				"posting_date": "2026-03-03",
			}).insert()

	def test_cancelling_purchase_order_releases_encumbrance(self):
		budget_line_name = self._make_budget_line("M", approved_budget=1000)
		requisition = self._make_requisition("M", budget_line=budget_line_name)
		po = frappe.get_doc({
			"doctype": "Purchase Order",
			"requisition": requisition.name,
			"posting_date": "2026-03-02",
		}).insert()

		budget_line = frappe.get_doc("Budget Line", budget_line_name)
		self.assertEqual(budget_line.committed_amount, po.amount)

		po.status = "Cancelled"
		po.save()

		budget_line.reload()
		self.assertEqual(budget_line.committed_amount, 0)
		self.assertEqual(budget_line.available_balance, 1000)

	def test_quotation_requires_a_document(self):
		vendor = self._make_vendor("Vendor N0")
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Requisition",
				"fund": "Fund A - General/Government",
				"budget_line": self._make_budget_line("N"),
				"purpose": "Requisition Test N",
				"posting_date": "2026-03-01",
				"items": [{"description": "Item N", "quantity": 1, "estimated_unit_cost": 50}],
				"quotations": [
					{"vendor": vendor, "quoted_amount": 50, "currency": "ZiG", "is_selected": 1},
				],
			}).insert()

	def test_purchase_order_blocked_for_unapproved_vendor(self):
		requisition = self._make_requisition("O", approved_vendors=False)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order",
				"requisition": requisition.name,
				"posting_date": "2026-03-02",
			}).insert()

	def test_purchase_order_quote_requirement_honors_configured_bands(self):
		# No School Setup band configured for this amount range -> falls back
		# to the PRAZ baseline of 3, same as if bands were never configured.
		requisition_default = self._make_requisition("P1", n_quotations=2)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order", "requisition": requisition_default.name, "posting_date": "2026-03-02",
			}).insert()

		# Configure a low-value band requiring only 1 quotation for amounts
		# under 500 -- this requisition's total_estimated_amount is 100.
		setup = self._ensure_school_setup()
		setup.set("procurement_quote_bands", [{"min_amount": 0, "required_quotes": 1}])
		setup.save()

		requisition_banded = self._make_requisition("P2", n_quotations=1)
		po = frappe.get_doc({
			"doctype": "Purchase Order", "requisition": requisition_banded.name, "posting_date": "2026-03-02",
		}).insert()
		self.assertEqual(po.amount, 100)

		# A higher band, requiring 5 quotations at or above 100, now applies to
		# the SAME 100-estimate requisition -- 3 quotations is no longer enough.
		setup.reload()
		setup.set("procurement_quote_bands", [{"min_amount": 0, "required_quotes": 1}, {"min_amount": 100, "required_quotes": 5}])
		setup.save()

		requisition_high_band = self._make_requisition("P3", n_quotations=3)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "Purchase Order", "requisition": requisition_high_band.name, "posting_date": "2026-03-02",
			}).insert()

		# Clean up so later tests in this same persistent-DB suite see the
		# baseline (empty bands / PRAZ default of 3) again.
		setup.reload()
		setup.set("procurement_quote_bands", [])
		setup.save()

	def test_reconcile_budget_lines_finds_no_discrepancy_after_normal_issuance(self):
		from edupro_school_fees.reports import reconcile_budget_lines

		budget_line_name = self._make_budget_line("Q", approved_budget=1000)
		requisition = self._make_requisition("Q", budget_line=budget_line_name)
		frappe.get_doc({
			"doctype": "Purchase Order", "requisition": requisition.name, "posting_date": "2026-03-02",
		}).insert()

		result = reconcile_budget_lines()
		flagged = [row for row in result["discrepancies"] if row["budget_line"] == budget_line_name]
		self.assertEqual(flagged, [])
