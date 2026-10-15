import frappe
from frappe.model.document import Document


class Requisition(Document):
	def validate(self):
		for row in self.items:
			row.estimated_amount = (row.quantity or 0) * (row.estimated_unit_cost or 0)
		self.total_estimated_amount = sum(row.estimated_amount or 0 for row in self.items)

		budget_line = frappe.get_doc("Budget Line", self.budget_line)
		if budget_line.fund != self.fund:
			frappe.throw(f"{self.budget_line} is on {budget_line.fund}, not {self.fund}.")

		vote_book_state = frappe.db.get_value("Budget Vote Book", budget_line.budget_vote_book, "workflow_state")
		if vote_book_state != "Active":
			frappe.throw(f"{budget_line.budget_vote_book} is not Active -- requisitions cannot be raised against it.")
