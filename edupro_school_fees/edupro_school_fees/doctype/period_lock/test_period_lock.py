"""Period Lock: the year-end closing Journal Entry (Income/Expense zeroed into
Accumulated Fund) and the posting-date lock it establishes afterwards -- the
lock is enforced once, centrally, in utils._create_journal_entry(), so this
also proves every JE-producing path (here: Invoice submission) actually
respects it, not just a hand-picked one."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestPeriodLock(FrappeTestCase):
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

	def _make_invoice(self, suffix, posting_date, amount=100):
		income = self._ensure_account("Fees Income", "Income")
		self._ensure_account("Debtors", "Asset")
		self._ensure_account("Accumulated Fund", "Equity")

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": f"PL Test Year {suffix}",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		term_name = frappe.get_all(
			"Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
		)[0]
		category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": f"PL Test Cat {suffix}"}).insert(ignore_if_duplicate=True)
		fee_item = frappe.get_doc({"doctype": "Fee Item", "item_name": f"PL Test Fee {suffix}", "default_amount": amount, "account": income}).insert(ignore_if_duplicate=True)

		fee_structure = frappe.get_doc({
			"doctype": "Fee Structure", "structure_name": f"PL Test Structure {suffix}",
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
			"doctype": "Student", "first_name": f"PL{suffix}", "last_name": "Test",
			"admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
		}).insert()

		return frappe.get_doc({
			"doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
			"posting_date": posting_date, "items": [{"fee_item": fee_item.name, "amount": amount}],
		}).insert()

	def _confirm_audit(self, lock_name):
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import confirm_audit_for_period_lock

		auditor = self._make_user("pl-auditor@rbac.test", "District Education Auditor/Inspector")
		current_user = frappe.session.user
		frappe.set_user(auditor)
		confirm_audit_for_period_lock(lock_name)
		frappe.set_user(current_user)

	def test_close_period_posts_closing_je_and_locks_prior_postings(self):
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import close_period

		invoice = self._make_invoice("A", "2026-03-15", amount=250)
		invoice.submit()

		head = self._make_user("pl-head-a@rbac.test", "School Head")
		lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": invoice.academic_year, "closing_date": "2026-03-31",
		}).insert()
		self._confirm_audit(lock.name)

		frappe.set_user(head)
		close_period(lock.name)
		frappe.set_user("Administrator")

		lock.reload()
		self.assertEqual(lock.status, "Closed")
		self.assertEqual(lock.net_surplus_deficit, 250)

		closing_je_name = frappe.db.get_value("Journal Entry", {"reference_doctype": "Period Lock", "reference_name": lock.name}, "name")
		self.assertTrue(closing_je_name)
		closing_je = frappe.get_doc("Journal Entry", closing_je_name)
		self.assertEqual(closing_je.total_debit, 250)
		self.assertEqual(closing_je.total_credit, 250)

		# A new Invoice dated inside the now-closed period must be blocked the
		# moment it tries to post its own Journal Entry on submit.
		late_invoice = self._make_invoice("B", "2026-03-20", amount=50)
		with self.assertRaises(frappe.ValidationError):
			late_invoice.submit()

		# ...but one dated after the closing date still posts normally.
		later_invoice = self._make_invoice("C", "2026-04-01", amount=50)
		later_invoice.submit()
		self.assertTrue(frappe.db.exists("Journal Entry", {"reference_doctype": "Invoice", "reference_name": later_invoice.name}))

	def test_only_school_head_can_close_a_period(self):
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import close_period

		bursar = self._make_user("pl-bursar-d@rbac.test", "Bursar")
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "PL Test Year D",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": academic_year.name, "closing_date": "2026-06-30",
		}).insert()

		frappe.set_user(bursar)
		with self.assertRaises(frappe.PermissionError):
			close_period(lock.name)

	def test_cannot_close_the_same_period_twice(self):
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import close_period

		invoice = self._make_invoice("E", "2026-02-15", amount=30)
		invoice.submit()

		head = self._make_user("pl-head-e@rbac.test", "School Head")
		lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": invoice.academic_year, "closing_date": "2026-02-28",
		}).insert()
		self._confirm_audit(lock.name)

		frappe.set_user(head)
		close_period(lock.name)
		with self.assertRaises(frappe.ValidationError):
			close_period(lock.name)

	def test_out_of_order_close_blocked_even_with_zero_net(self):
		# DEF-022: the chronological-order check normally comes for free via
		# _create_journal_entry()'s closed-period guard, but that's only
		# called when there's a nonzero net to post -- a period with exactly
		# zero net Income/Expense (no invoices/receipts in it at all) never
		# reached that check at all, letting periods close out of order.
		#
		# This project's tests run against one shared, cumulative site (no
		# throwaway test DB), so a genuinely zero-net window can't be
		# guaranteed by date range alone -- far-future dates keep this clear
		# of every other fixture's activity regardless. The assertion that
		# matters is the chronological block itself, not the net figure.
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import close_period

		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "PL Test Year H",
			"start_date": "2099-01-01", "end_date": "2099-12-31",
		}).insert(ignore_if_duplicate=True)

		head = self._make_user("pl-head-h@rbac.test", "School Head")

		later_lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": academic_year.name, "closing_date": "2099-06-30",
		}).insert()
		self._confirm_audit(later_lock.name)
		frappe.set_user(head)
		close_period(later_lock.name)
		frappe.set_user("Administrator")
		later_lock.reload()
		self.assertEqual(later_lock.status, "Closed")

		earlier_lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": academic_year.name, "closing_date": "2099-03-31",
		}).insert()
		self._confirm_audit(earlier_lock.name)
		frappe.set_user(head)
		with self.assertRaises(frappe.ValidationError):
			close_period(earlier_lock.name)

	def test_close_period_blocked_without_audit_confirmation(self):
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import close_period

		head = self._make_user("pl-head-f@rbac.test", "School Head")
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "PL Test Year F",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": academic_year.name, "closing_date": "2026-06-30",
		}).insert()

		frappe.set_user(head)
		with self.assertRaises(frappe.ValidationError):
			close_period(lock.name)

	def test_only_district_auditor_can_confirm_audit(self):
		from edupro_school_fees.edupro_school_fees.doctype.period_lock.period_lock import confirm_audit_for_period_lock

		bursar = self._make_user("pl-bursar-g@rbac.test", "Bursar")
		academic_year = frappe.get_doc({
			"doctype": "Academic Year", "academic_year_name": "PL Test Year G",
			"start_date": "2026-01-01", "end_date": "2026-12-31",
		}).insert(ignore_if_duplicate=True)
		lock = frappe.get_doc({
			"doctype": "Period Lock", "academic_year": academic_year.name, "closing_date": "2026-06-30",
		}).insert()

		frappe.set_user(bursar)
		with self.assertRaises(frappe.PermissionError):
			confirm_audit_for_period_lock(lock.name)
