import frappe
from frappe.model.document import Document
from frappe.utils import flt


class Student(Document):
	def validate(self):
		self._validate_withdrawal_clearance()

	def _validate_withdrawal_clearance(self):
		"""DEF-014: status could be set to Withdrawn/Transferred Out with zero
		check against any open Invoice balance -- a student could be marked
		gone with an unpaid debt and a clearance certificate number filled in
		freely, nothing checking that clearance was actually earned. Doesn't
		outright block withdrawal with a balance still owing (real schools do
		withdraw debtors and keep chasing the debt) -- requires the Bursar to
		record a Clearance Certificate Number as their documented
		justification, so this can never happen silently."""
		if self.status not in ("Withdrawn", "Transferred Out"):
			return

		doc_before_save = self.get_doc_before_save() if not self.is_new() else None
		prev_status = doc_before_save.status if doc_before_save else None
		if prev_status == self.status:
			return

		outstanding = flt(frappe.db.sql(
			"SELECT COALESCE(SUM(outstanding_amount), 0) FROM `tabInvoice` WHERE student=%s AND docstatus=1",
			self.name,
		)[0][0], 2) if self.name else 0

		if outstanding > 0 and not self.clearance_certificate_number:
			frappe.throw(
				f"{self.name or 'This student'} has an outstanding balance of {outstanding} and cannot be "
				f"marked {self.status} without a Clearance Certificate Number on record."
			)

	def on_trash(self):
		"""A Student record is never deleted, full stop -- the school's policy is
		to track every child from their first day forward, so the record itself
		is permanent; Suspended/Withdrawn/Transferred Out/Deceased/Graduated
		(status) is how a student's departure is recorded instead. This fires
		for every caller regardless of role, including Administrator, which
		bypasses ordinary DocType permission checks by Frappe's own design --
		removing "delete" from every role in student.json stops it from being
		offered in the UI, but this is the real backstop.

		Temporary, narrow exception: delete_student_for_correction() below sets
		frappe.flags.allow_student_delete_for_correction for the duration of its
		own call so the Bursar can remove a student record that was a clear
		data-entry mistake. That flag can only be set from server-side code, not
		by any request parameter, so this backstop still holds for every other
		caller (desk, API, bulk actions)."""
		if frappe.flags.get("allow_student_delete_for_correction"):
			return
		frappe.throw(
			"Student records cannot be deleted. Change this student's Status instead "
			"(Suspended, Withdrawn, Transferred Out, Deceased, or Graduated)."
		)


@frappe.whitelist()
def delete_student_for_correction(student, justification):
	"""Temporary, narrowly-scoped exception to the permanent-record policy in
	Student.on_trash() above -- added so the Bursar can remove a student
	record that was a clear data-entry mistake (e.g. a duplicate added by
	hand, the same child re-entered under a different name) while the
	broader delete/undo policy is still being worked out. Most Active
	students already carry at least one Invoice (the 2026 Balances.xlsx
	opening-balance import touched almost everyone), so refusing to delete
	an invoiced student would make this unusable for the actual duplicates
	it exists to fix -- instead, any submitted Invoice for this student is
	cancelled first (reversing its Journal Entry the same way the October
	2026 duplicate-student cleanup did), then left on record as a cancelled,
	now-orphaned document, same as that cleanup's leftovers. Still refuses a
	student with a recorded Receipt (real money actually received) -- that
	is genuine payment history, not administrative noise, and must go
	through a Status change instead."""
	if "Bursar" not in frappe.get_roles(frappe.session.user) and "System Manager" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may delete a student record.", frappe.PermissionError)

	if not frappe.db.exists("Student", student):
		frappe.throw(f"No such student: {student}")

	if not (justification or "").strip():
		frappe.throw("A reason is required to delete a student record.")

	if frappe.db.exists("Receipt", {"student": student}):
		frappe.throw(
			"This student has recorded payments and cannot be deleted. "
			"Change the Status instead (Suspended, Withdrawn, Transferred Out, Deceased, or Graduated)."
		)

	from edupro_school_fees.utils import _create_audit_log

	doc = frappe.get_doc("Student", student)
	_create_audit_log(doc, action="Student Deleted (Correction)", justification=justification)

	invoice_names = frappe.get_all("Invoice", filters={"student": student}, pluck="name")
	for invoice_name in invoice_names:
		invoice = frappe.get_doc("Invoice", invoice_name)
		if invoice.docstatus == 1:
			je_names = frappe.get_all(
				"Journal Entry",
				filters={"reference_doctype": "Invoice", "reference_name": invoice_name, "docstatus": 1},
				pluck="name",
			)
			for je_name in je_names:
				je = frappe.get_doc("Journal Entry", je_name)
				je.flags.ignore_permissions = True
				je.cancel()
			invoice.flags.ignore_permissions = True
			invoice.cancel()

	frappe.flags.allow_student_delete_for_correction = True
	try:
		frappe.delete_doc("Student", student, ignore_permissions=True, force=True)
		frappe.db.commit()
	finally:
		frappe.flags.allow_student_delete_for_correction = False


@frappe.whitelist(allow_guest=True)
def verify_student_document(student):
	"""Guest-accessible confirmation that a printed Statement or Profile's QR
	code points at a real, current student record -- deliberately returns
	only non-financial identity fields (name/grade/status), never balances or
	guardian details, so scanning a lost/discarded document can't be used to
	pull a family's financial history the way a Receipt's own QR now can
	(that tradeoff was made explicitly for Receipts; this is a narrower,
	separate check that doesn't need it)."""
	if not frappe.db.exists("Student", student):
		return {"valid": False, "reason": "No such student record."}

	row = frappe.db.get_value(
		"Student", student, ["first_name", "last_name", "grade", "status"], as_dict=True
	)
	school_name = frappe.db.get_value("School Setup", filters={}, fieldname="school_name")
	return {
		"valid": True,
		"student": student,
		"first_name": row.first_name,
		"last_name": row.last_name,
		"grade": row.grade,
		"status": row.status,
		"school_name": school_name,
	}
