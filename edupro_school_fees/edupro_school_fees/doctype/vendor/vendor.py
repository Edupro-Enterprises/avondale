import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class Vendor(Document):
	pass


@frappe.whitelist()
def approve_vendor(vendor):
	"""Only a School Head may admit a vendor onto the approved list -- a
	Quotation Item can name any vendor while a Requisition is still being
	assembled, but Purchase Order.validate() refuses to issue against one
	that isn't Approved (see purchase_order.py)."""
	if "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only School Head may approve a vendor.", frappe.PermissionError)

	doc = frappe.get_doc("Vendor", vendor)
	if doc.approval_status == "Approved":
		frappe.throw(f"{doc.name} is already Approved.")

	doc.flags.ignore_permissions = True
	doc.approval_status = "Approved"
	doc.approved_by = frappe.session.user
	doc.approved_on = now_datetime()
	doc.suspension_reason = None
	doc.save()

	from edupro_school_fees.utils import _create_audit_log
	_create_audit_log(doc, action="Vendor approved")
	return doc.name


@frappe.whitelist()
def suspend_vendor(vendor, reason):
	"""Removes a vendor from the approved list -- any Purchase Order already
	issued against them is untouched (this only blocks new ones), matching
	how a suspended Fee Structure or role change never rewrites past
	transactions in this app."""
	if "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only School Head may suspend a vendor.", frappe.PermissionError)
	if not reason or not reason.strip():
		frappe.throw("A suspension reason is required.")

	doc = frappe.get_doc("Vendor", vendor)
	doc.flags.ignore_permissions = True
	doc.approval_status = "Suspended"
	doc.approved_by = frappe.session.user
	doc.approved_on = now_datetime()
	doc.suspension_reason = reason.strip()
	doc.save()

	from edupro_school_fees.utils import _create_audit_log
	_create_audit_log(doc, action="Vendor suspended", justification=reason.strip())
	return doc.name
