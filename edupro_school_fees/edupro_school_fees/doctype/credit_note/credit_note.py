import frappe
from frappe.model.document import Document
from frappe.utils import flt, now_datetime


class CreditNote(Document):
	def validate(self):
		if self.workflow_state == "Rejected":
			return

		invoice = frappe.get_doc("Invoice", self.invoice)
		if invoice.docstatus != 1:
			frappe.throw(f"{invoice.name} is not a submitted Invoice.")

		outstanding = flt(invoice.outstanding_amount, 2)
		# Once Approved, a Credit Note posts its own JE and reduces the invoice --
		# re-validating against outstanding_amount on a later save (e.g. workflow
		# metadata only) would wrongly compare against the ALREADY-reduced figure.
		if self.workflow_state == "Draft" or self.is_new():
			if flt(self.amount, 2) <= 0:
				frappe.throw("Amount must be greater than zero.")
			if flt(self.amount, 2) > outstanding:
				frappe.throw(f"Amount ({self.amount}) cannot exceed {invoice.name}'s outstanding balance ({outstanding}).")

		if self.workflow_state == "Approved" and not self.approved_on:
			# The Workflow's own allow_self_approval=0 only ever gets checked by
			# apply_workflow() (frappe/model/workflow.py) -- it does nothing for a
			# plain `doc.workflow_state = "Approved"; doc.save()`, which is how
			# this app's own frontend (and these tests) actually drive workflow
			# transitions. Real protection has to live here, same as Payment
			# Voucher's _block_same_actor() -- both the role check and the
			# self-approval check below, not just the latter.
			if "School Head" not in frappe.get_roles(frappe.session.user):
				frappe.throw(
					f"{frappe.session.user} is not a School Head and cannot approve this Credit Note.",
					frappe.PermissionError,
				)
			if frappe.session.user == self.owner and frappe.session.user != "Administrator":
				frappe.throw(f"{frappe.session.user} drafted this Credit Note and cannot also approve it.")
			self.approved_by = frappe.session.user
			self.approved_on = now_datetime()

	def on_update(self):
		if self.workflow_state != "Approved":
			return
		if self.flags.get("_gl_posted"):
			return

		doc_before_save = self.get_doc_before_save()
		if doc_before_save and doc_before_save.workflow_state == "Approved":
			return

		from edupro_school_fees.utils import create_journal_entry_for_credit_note

		create_journal_entry_for_credit_note(self)
		self.flags._gl_posted = True

	def on_trash(self):
		if self.workflow_state == "Approved":
			frappe.throw("An Approved Credit Note cannot be deleted -- it is part of the audit trail.")
