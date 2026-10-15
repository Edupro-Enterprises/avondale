import hashlib

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

_LOCKED_HEADER_FIELDS = ["structure_name", "academic_year", "term", "beneficiary_category", "agm_minutes", "mopse_approval_letter"]


def _hash_attached_file(file_url):
	if not file_url:
		return None
	file_doc = frappe.db.get_value("File", {"file_url": file_url}, "name")
	if not file_doc:
		return None
	content = frappe.get_doc("File", file_doc).get_content()
	if isinstance(content, str):
		content = content.encode("utf-8")
	return hashlib.sha256(content).hexdigest()


class FeeStructure(Document):
	def validate(self):
		self.total_amount = sum(row.amount or 0 for row in self.items)

		# Governance gate (spec: Setup, Governance, and Fee Approval): a Fee Structure
		# cannot become Approved without both the AGM minute and the MoPSE approval
		# letter attached.
		if self.workflow_state == "Approved" and not (self.agm_minutes and self.mopse_approval_letter):
			frappe.throw(
				"Fee Structure cannot be approved without both AGM Minutes and the "
				"MoPSE Approval Letter attached."
			)

		# Spec 5.1's Master Permissions Matrix marks "Approve Termly Fee Structures"
		# as Co-Sign for both School Head and SDC Chairperson/Treasurer -- the
		# Fees Approver's own final Approve transition (Workflow: Pending Approval
		# -> Approved) is blocked here until both independent co-signs exist,
		# the same validate()-layered precondition already used for sensitive
		# procurement rather than a new Workflow state.
		if self.workflow_state == "Approved" and not (self.school_head_co_signed_by and self.sdc_co_signed_by):
			frappe.throw(
				"Fee Structure cannot be approved without co-signatures from both the "
				"School Head and the SDC Chairperson/Treasurer. Use co_sign_fee_structure()."
			)

		if self.has_value_changed("agm_minutes"):
			self.agm_minutes_hash = _hash_attached_file(self.agm_minutes)
		if self.has_value_changed("mopse_approval_letter"):
			self.mopse_approval_letter_hash = _hash_attached_file(self.mopse_approval_letter)

		if self.workflow_state == "Approved" and not self.approved_on:
			self.approved_by = frappe.session.user
			self.approved_on = now_datetime()

	def on_update(self):
		if self.workflow_state == "Approved" and self.revision_of:
			frappe.db.set_value("Fee Structure", self.revision_of, "superseded_by", self.name)

		# Approved Fee Structures are locked/versioned, not edited in place --
		# neither their line items nor any of the header fields that identify
		# what was actually approved (which term, which category, which
		# evidence). create_revision() above is the only sanctioned way to
		# change an Approved structure's figures.
		#
		# has_value_changed() is unreliable for Table fields: BaseDocument has no
		# value equality, so comparing lists of child Documents is always True even
		# when their contents match. Compare the item contents explicitly instead.
		if self.workflow_state != "Approved":
			return

		doc_before_save = self.get_doc_before_save()
		if not doc_before_save:
			return

		for field in _LOCKED_HEADER_FIELDS:
			if doc_before_save.get(field) != self.get(field):
				frappe.throw(
					f"An Approved Fee Structure cannot be edited ({field} would change). "
					"Create a revision instead."
				)

		before_items = [(row.fee_item, row.amount, row.beneficiary_category) for row in doc_before_save.items]
		after_items = [(row.fee_item, row.amount, row.beneficiary_category) for row in self.items]
		if before_items != after_items:
			frappe.throw("An Approved Fee Structure cannot be edited (fee items would change). Create a revision instead.")


@frappe.whitelist()
def create_revision(fee_structure):
	"""Clones an Approved Fee Structure into a new Draft carrying revision_of,
	so a genuine version chain exists instead of an edit-lock with a comment
	telling staff to start over by hand. The new revision goes through the
	normal Draft -> Pending Approval -> Approved workflow; once it reaches
	Approved, the original is stamped superseded_by so anyone looking at it
	knows it is historical, not current."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may start a Fee Structure revision.", frappe.PermissionError)

	original = frappe.get_doc("Fee Structure", fee_structure)
	if original.workflow_state != "Approved":
		frappe.throw("Only an Approved Fee Structure can be revised.")
	if original.superseded_by:
		frappe.throw(f"{original.name} has already been superseded by {original.superseded_by}.")

	# Fee Structure's own autoname is {academic_year}-{term}-{structure_name} --
	# a revision deliberately keeps the same academic_year/term/beneficiary_category
	# as the original for continuity, so structure_name is the only part of that
	# key a revision can vary without colliding with the very record it revises.
	revision_structure_name = f"{original.structure_name} (Rev {frappe.utils.now_datetime().strftime('%Y%m%d%H%M%S')})"

	revision = frappe.get_doc({
		"doctype": "Fee Structure",
		"structure_name": revision_structure_name,
		"academic_year": original.academic_year,
		"term": original.term,
		"beneficiary_category": original.beneficiary_category,
		"items": [
			{"fee_item": row.fee_item, "amount": row.amount, "beneficiary_category": row.beneficiary_category}
			for row in original.items
		],
		"revision_of": original.name,
	})
	revision.insert()
	return revision.name


@frappe.whitelist()
def co_sign_fee_structure(fee_structure):
	"""School Head and SDC Chairperson/Treasurer each independently co-sign a
	Fee Structure while it's Pending Approval -- both are required (validate()
	above) before the Fees Approver's own Approve transition can succeed. A
	single person holding both roles still can't provide both co-signs alone,
	the same protection Payment Voucher already has against one person
	executing two approval steps."""
	roles = frappe.get_roles(frappe.session.user)
	doc = frappe.get_doc("Fee Structure", fee_structure)
	if doc.workflow_state != "Pending Approval":
		frappe.throw(f"{doc.name} is not Pending Approval.")

	if "School Head" in roles and not doc.school_head_co_signed_by:
		if doc.sdc_co_signed_by and frappe.session.user == doc.sdc_co_signed_by:
			frappe.throw(f"{frappe.session.user} already provided the SDC co-signature and cannot also provide the School Head one.")
		doc.flags.ignore_permissions = True
		doc.school_head_co_signed_by = frappe.session.user
		doc.school_head_co_signed_on = now_datetime()
		doc.save()
		return doc.name

	if "SDC Chairperson/Treasurer" in roles and not doc.sdc_co_signed_by:
		if doc.school_head_co_signed_by and frappe.session.user == doc.school_head_co_signed_by:
			frappe.throw(f"{frappe.session.user} already provided the School Head co-signature and cannot also provide the SDC one.")
		doc.flags.ignore_permissions = True
		doc.sdc_co_signed_by = frappe.session.user
		doc.sdc_co_signed_on = now_datetime()
		doc.save()
		return doc.name

	frappe.throw(
		"Only School Head or SDC Chairperson/Treasurer may co-sign a Fee Structure, "
		"and each may only provide their own co-signature once.",
		frappe.PermissionError,
	)
