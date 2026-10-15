import frappe
from frappe.model.document import Document
from frappe.utils import flt


class BudgetLine(Document):
	def validate(self):
		vote_book_state = frappe.db.get_value("Budget Vote Book", self.budget_vote_book, "workflow_state")
		if self.is_new() and vote_book_state == "Closed":
			frappe.throw(f"{self.budget_vote_book} is Closed -- no new Budget Lines may be added to it.")

		if self.is_new() and self.available_balance in (None, 0):
			self.available_balance = flt(self.approved_budget, 2)

	def adjust(self, committed_delta=0, actual_delta=0):
		"""Move money between committed (encumbered but unpaid) and actual_spend
		(journal-posted), recomputing available_balance from the fixed approved_budget --
		never from a running total, so this can never drift out of sync."""
		committed = flt((self.committed_amount or 0) + committed_delta, 2)
		actual = flt((self.actual_spend or 0) + actual_delta, 2)
		available = flt(self.approved_budget - committed - actual, 2)

		frappe.db.set_value(
			"Budget Line",
			self.name,
			{
				"committed_amount": committed,
				"actual_spend": actual,
				"available_balance": available,
			},
		)
