"""Journal Entry had no dedicated test file before this fix -- the doctype
carrying the general ledger's own balance invariant and append-only guarantee
was previously exercised only incidentally via test_invoice.py and the Phase 7
statement-report tests. These cover Journal Entry's own controller directly:
the debit=credit gate, and the "cancel then delete" loophole closed alongside
the same gap on Invoice.
"""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestJournalEntry(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _ensure_account(self, account_name, account_type):
		if not frappe.db.exists("Account", account_name):
			frappe.get_doc({
				"doctype": "Account",
				"account_name": account_name,
				"account_type": account_type,
				"currency": "ZiG",
			}).insert()
		return account_name

	def test_unbalanced_entry_is_rejected(self):
		debtors = self._ensure_account("JE Test Debtors", "Asset")
		income = self._ensure_account("JE Test Income", "Income")

		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Deliberately unbalanced test entry",
			"entries": [
				{"account": debtors, "debit": 100, "credit": 0},
				{"account": income, "debit": 0, "credit": 90},
			],
		})
		with self.assertRaises(frappe.ValidationError):
			je.insert()

	def test_balanced_entry_survives_floating_point_summation_artifacts(self):
		# DEF-QA3-001: found live seeding real data -- an invoice combining a
		# pro-rated charge with a carry-forward line produced debit/credit
		# sums that were genuinely equal in money terms (323.96 == 323.96)
		# but differed by a few ULPs as raw Python floats
		# (323.96 vs 323.96000000000004), and the old strict `!=` on
		# unrounded sums rejected it. 0.1 + 0.1 + 0.1 != 0.3 in IEEE 754 is
		# the textbook minimal repro of the same class of bug.
		debtors = self._ensure_account("JE Float Test Debtors", "Asset")
		income = self._ensure_account("JE Float Test Income", "Income")

		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Floating-point summation artifact regression test",
			"entries": [
				{"account": debtors, "debit": 0.1, "credit": 0},
				{"account": debtors, "debit": 0.1, "credit": 0},
				{"account": debtors, "debit": 0.1, "credit": 0},
				{"account": income, "debit": 0, "credit": 0.3},
			],
		}).insert()
		je.submit()
		self.assertEqual(je.total_debit, 0.3)
		self.assertEqual(je.total_credit, 0.3)

	def test_balanced_entry_is_accepted(self):
		debtors = self._ensure_account("JE Test Debtors", "Asset")
		income = self._ensure_account("JE Test Income", "Income")

		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Balanced test entry",
			"entries": [
				{"account": debtors, "debit": 100, "credit": 0},
				{"account": income, "debit": 0, "credit": 100},
			],
		}).insert()
		je.submit()
		self.assertEqual(je.total_debit, 100)
		self.assertEqual(je.total_credit, 100)

	def test_submitted_entry_cannot_be_deleted_even_after_cancel(self):
		debtors = self._ensure_account("JE Test Debtors", "Asset")
		income = self._ensure_account("JE Test Income", "Income")

		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Cancel-then-delete regression test",
			"entries": [
				{"account": debtors, "debit": 50, "credit": 0},
				{"account": income, "debit": 0, "credit": 50},
			],
		}).insert()
		je.submit()

		je.cancel()
		self.assertTrue(
			frappe.db.exists("Audit Log", {
				"reference_doctype": "Journal Entry", "reference_name": je.name, "action": "Journal Entry Cancelled",
			})
		)
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Journal Entry", je.name)

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

	def test_reverse_journal_entry_posts_opposite_lines_and_links_both_ways(self):
		# DEF-017: only Receipt had a guided reversal flow -- every other
		# Journal Entry needed a manually-keyed, unlinked compensating entry.
		from edupro_school_fees.edupro_school_fees.doctype.journal_entry.journal_entry import reverse_journal_entry

		debtors = self._ensure_account("JE Rev Test Debtors", "Asset")
		income = self._ensure_account("JE Rev Test Income", "Income")
		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Original entry to be reversed",
			"entries": [
				{"account": debtors, "debit": 75, "credit": 0},
				{"account": income, "debit": 0, "credit": 75},
			],
		}).insert()
		je.submit()

		head = self._make_user("je-rev-head@rbac.test", "School Head")
		frappe.set_user(head)
		reversal_name = reverse_journal_entry(je.name, "Posted to the wrong income account")
		frappe.set_user("Administrator")

		reversal = frappe.get_doc("Journal Entry", reversal_name)
		by_account = {row.account: (row.debit, row.credit) for row in reversal.entries}
		self.assertEqual(by_account[debtors], (0, 75))
		self.assertEqual(by_account[income], (75, 0))
		self.assertEqual(reversal.reversal_of, je.name)

		je.reload()
		self.assertEqual(je.reversed_by, reversal_name)

		with self.assertRaises(frappe.ValidationError):
			reverse_journal_entry(je.name, "Trying again")
		with self.assertRaises(frappe.ValidationError):
			reverse_journal_entry(reversal_name, "Cannot reverse a reversal")

	def test_reverse_journal_entry_requires_school_head(self):
		from edupro_school_fees.edupro_school_fees.doctype.journal_entry.journal_entry import reverse_journal_entry

		debtors = self._ensure_account("JE Rev Test Debtors B", "Asset")
		income = self._ensure_account("JE Rev Test Income B", "Income")
		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Original entry",
			"entries": [
				{"account": debtors, "debit": 20, "credit": 0},
				{"account": income, "debit": 0, "credit": 20},
			],
		}).insert()
		je.submit()

		bursar = self._make_user("je-rev-bursar@rbac.test", "Bursar")
		frappe.set_user(bursar)
		with self.assertRaises(frappe.PermissionError):
			reverse_journal_entry(je.name, "Not authorized")

	def test_never_submitted_draft_can_still_be_deleted(self):
		debtors = self._ensure_account("JE Test Debtors", "Asset")
		income = self._ensure_account("JE Test Income", "Income")

		je = frappe.get_doc({
			"doctype": "Journal Entry",
			"posting_date": "2026-01-10",
			"remarks": "Never-submitted draft, should still be deletable",
			"entries": [
				{"account": debtors, "debit": 10, "credit": 0},
				{"account": income, "debit": 0, "credit": 10},
			],
		}).insert()
		self.assertEqual(je.docstatus, 0)
		frappe.delete_doc("Journal Entry", je.name)
		self.assertFalse(frappe.db.exists("Journal Entry", je.name))
