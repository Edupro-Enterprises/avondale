import frappe
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

from edupro_school_fees.reports import _log_report_generated, _require_internal_role
from edupro_school_fees.utils import compute_ageing_bucket


class DebtorCase(Document):
	def validate(self):
		self.refresh_ageing()

		# Confirmed real gap: nothing previously stopped marking a case Resolved
		# while it still owed money -- refresh_ageing() above always recomputes
		# outstanding_amount fresh from open Invoices first, so this check can't
		# be fooled by a stale value.
		if self.workflow_state == "Resolved" and self.outstanding_amount > 0:
			frappe.throw(
				f"{self.name} still has {self.outstanding_amount} outstanding -- "
				"it can't be resolved until the balance is paid or written off."
			)

		if self.workflow_state == "Resolved" and not self.resolved_on:
			self.resolved_on = nowdate()
		if self.workflow_state != "Resolved":
			self.resolved_on = None

	def refresh_ageing(self):
		"""Recompute outstanding_amount/ageing_bucket from this student's own open
		Invoices -- the Debtor Case never stores its own independent balance, so it
		can never drift from the ledger it's summarizing."""
		open_invoices = frappe.get_all(
			"Invoice",
			filters={"student": self.student, "docstatus": 1, "outstanding_amount": [">", 0]},
			fields=["outstanding_amount", "due_date"],
		)

		self.outstanding_amount = sum(row.outstanding_amount for row in open_invoices)

		oldest_due_date = min((row.due_date for row in open_invoices if row.due_date), default=None)
		self.days_overdue = (getdate(nowdate()) - getdate(oldest_due_date)).days if oldest_due_date else 0
		self.ageing_bucket = compute_ageing_bucket(self.days_overdue)

		# A case that's back to fully current (paid off, or never really overdue)
		# starts its reminder cadence fresh if it runs up debt again later --
		# otherwise a case reminded to "Escalation" once would silently skip its
		# First/Second reminders on any later, unrelated overdue cycle.
		if self.days_overdue <= 0:
			self.last_reminder_stage = "None"


@frappe.whitelist()
def get_ageing_summary():
	"""Aggregate open Debtor Case count/outstanding-amount per ageing bucket, for the
	frontend's debtor-case dashboard (Phase 5.4). Uses frappe.get_all(), which
	bypasses DocType-level read permissions -- unlike every sibling report in
	reports.py/statutory_reports_extra.py, this one had no explicit role gate,
	so any authenticated user (Parent/Student included) could call it directly
	and get school-wide outstanding-debt figures. DEF-003."""
	_require_internal_role()
	_log_report_generated("Aged Debtor Summary")
	rows = frappe.get_all(
		"Debtor Case",
		filters={"workflow_state": ["!=", "Resolved"]},
		fields=["ageing_bucket", "outstanding_amount"],
	)

	summary = {}
	for row in rows:
		bucket = summary.setdefault(row.ageing_bucket, {"case_count": 0, "outstanding_amount": 0})
		bucket["case_count"] += 1
		bucket["outstanding_amount"] += row.outstanding_amount or 0

	return summary
