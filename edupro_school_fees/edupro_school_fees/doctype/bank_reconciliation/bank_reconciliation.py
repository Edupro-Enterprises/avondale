import frappe
from frappe.model.document import Document
from frappe.utils import flt


class BankReconciliation(Document):
	def validate(self):
		self.balance_per_cashbook = self._compute_cashbook_balance()
		self.reconciled_balance = flt(
			(self.balance_per_cashbook or 0) + sum(row.amount or 0 for row in self.adjustments), 2
		)
		self.variance = flt(self.reconciled_balance - self.balance_per_statement, 2)

		if self.workflow_state == "Reconciled" and abs(self.variance) > 0.01:
			frappe.throw(
				f"Cannot mark Reconciled while a variance of {self.variance} remains -- "
				"add or correct reconciling items until it nets to zero."
			)

	def _compute_cashbook_balance(self):
		result = frappe.db.sql(
			"""
			SELECT COALESCE(SUM(jea.debit), 0) - COALESCE(SUM(jea.credit), 0)
			FROM `tabJournal Entry Account` jea
			INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
			WHERE jea.account = %s AND je.docstatus = 1 AND je.posting_date <= %s
			""",
			(self.bank_account, self.period_end),
		)
		return flt(result[0][0]) if result else 0
