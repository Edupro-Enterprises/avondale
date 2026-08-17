import frappe
from frappe import _
from frappe.model.document import Document


class VoteBookAllocation(Document):
	def validate(self):
		self.validate_duplicate()
		self.calculate_available_balance()

	def validate_duplicate(self):
		existing = frappe.db.exists(
			"Vote Book Allocation",
			{
				"fiscal_year": self.fiscal_year,
				"fund_category": self.fund_category,
				"expense_account": self.expense_account,
				"name": ["!=", self.name],
			},
		)
		if existing:
			frappe.throw(
				_("A Vote Book Allocation already exists for {0} / {1} / {2}").format(
					self.expense_account, self.fund_category, self.fiscal_year
				)
			)

	def calculate_available_balance(self):
		self.committed_amount = self.committed_amount or 0
		self.actual_spent = self.actual_spent or 0
		self.available_balance = (self.approved_budget or 0) - (
			self.committed_amount + self.actual_spent
		)
