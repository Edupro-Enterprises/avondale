import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

from edupro_school_fees.permissions import FUND_B


class PaymentVoucher(Document):
	def validate(self):
		# Same-person approval gate (spec FR-PV-02: "final approval cannot be the
		# same person as the requisitioner"). Frappe's own allow_self_approval=0
		# on the workflow only ever compares against this *document's* owner (the
		# Bursar who drafted the PV), never against the original Requisition's
		# requester or the previous approval step's actor -- so without this check
		# a single person holding two of {SDC Chairperson/Treasurer, School Head}
		# could legally execute two of the three approval steps alone.
		doc_before_save = self.get_doc_before_save() if not self.is_new() else None
		prev_state = doc_before_save.workflow_state if doc_before_save else None

		# Fund A (government/tuition) spend has no SDC oversight role -- spec
		# 5.2.3 gives SDC Chairperson/Treasurer "no access to Fund A" at all, and
		# permissions.py fund-scopes their read/write to Fund B only. The
		# frontend always requests "Pending SDC Co-Approval" as the next state
		# after Draft (it doesn't know the fund-conditional rule), so a Fund A
		# voucher would otherwise land in a state only an SDC user can act on
		# and that SDC user can never even see it -- permanently stuck. Route it
		# straight to School Head instead, here, so this holds regardless of
		# what any caller (frontend or Desk) actually requests.
		if prev_state == "Draft" and self.workflow_state == "Pending SDC Co-Approval" and self.fund != FUND_B:
			self.workflow_state = "Pending School Head Approval"

		if self.workflow_state == "Pending School Head Approval" and prev_state == "Pending SDC Co-Approval":
			self._block_same_actor("SDC Co-Approval")
			self.co_approved_by = frappe.session.user

		if self.workflow_state == "Approved" and prev_state == "Pending School Head Approval":
			self._block_same_actor("School Head Approval")
			if self.is_sensitive_procurement and not self.sensitive_co_signed_by:
				frappe.throw(
					"This Purchase Order is at or above the sensitive-procurement threshold and needs a "
					"District Education Auditor/Inspector co-signature (co_sign_sensitive_procurement) "
					"before School Head can give final approval."
				)
			self.final_approved_by = frappe.session.user

		if self.workflow_state == "Approved" and not self.approved_on:
			self.approved_on = now_datetime()
		if self.workflow_state != "Approved":
			self.approved_on = None

	def _block_same_actor(self, step_label):
		requested_by = self._requisition_requester()
		if requested_by and frappe.session.user == requested_by:
			frappe.throw(
				f"{frappe.session.user} raised the original Requisition for this Payment "
				f"Voucher and cannot also perform {step_label}."
			)
		if self.co_approved_by and frappe.session.user == self.co_approved_by:
			frappe.throw(
				f"{frappe.session.user} already performed the SDC Co-Approval step on this "
				f"Payment Voucher and cannot also perform {step_label}."
			)

	def _requisition_requester(self):
		requisition = frappe.db.get_value("Purchase Order", self.purchase_order, "requisition")
		return frappe.db.get_value("Requisition", requisition, "requested_by") if requisition else None


@frappe.whitelist()
def co_sign_sensitive_procurement(payment_voucher):
	"""A District Education Auditor/Inspector's independent sign-off, required
	before School Head can give final approval on a sensitive-value Purchase
	Order (School Setup's sensitive_procurement_threshold). Their DocPerm on
	Payment Voucher is read-only by design -- an external oversight role, not
	an internal approver for every voucher -- so this narrowly elevates just
	this one field-set, the same pattern already used by
	approve_receipt_reversal/the MoPSE ED46 methods."""
	if "District Education Auditor/Inspector" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a District Education Auditor/Inspector may co-sign a sensitive procurement.", frappe.PermissionError)

	doc = frappe.get_doc("Payment Voucher", payment_voucher)
	if not doc.is_sensitive_procurement:
		frappe.throw(f"{doc.name} is not flagged as a sensitive procurement -- no co-signature is required.")
	if doc.workflow_state not in ("Pending SDC Co-Approval", "Pending School Head Approval"):
		frappe.throw(f"{doc.name} is not awaiting approval.")
	if doc.sensitive_co_signed_by:
		frappe.throw(f"{doc.name} has already been co-signed by {doc.sensitive_co_signed_by}.")
	if frappe.session.user == doc._requisition_requester():
		frappe.throw(f"{frappe.session.user} raised the original Requisition for this Payment Voucher and cannot also co-sign it.")

	doc.flags.ignore_permissions = True
	doc.sensitive_co_signed_by = frappe.session.user
	doc.sensitive_co_signed_on = now_datetime()
	doc.save()

	from edupro_school_fees.utils import _create_audit_log
	_create_audit_log(doc, action="Sensitive procurement co-signed")
	return doc.name
