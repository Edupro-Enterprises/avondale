import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, nowdate


class Applicant(Document):
	def validate(self):
		if self.status == "Declined" and not self.decision_notes:
			frappe.throw("Record a reason before declining an applicant.")

	def on_update(self):
		self._post_application_fee()

	def _post_application_fee(self):
		"""DEF-016: application_fee_amount used to be "informational only" --
		receipted at the till but never touching the GL, unlike every other
		money movement in the app. Posts once (application_fee_journal_entry
		guards against re-posting on later saves) Dr Cash-in-Till / Cr
		Application Fees Income. ZiG-denominated fees only -- unlike
		create_journal_entry_for_receipt/_invoice (now fixed to convert a
		document's own currency into BASE_CURRENCY before posting, see
		_to_base_currency), this one still just skips a USD application fee
		rather than converting it; deliberately not extended in the same
		pass since a USD applicant fee is a genuinely rare/unverified path,
		not the confirmed, high-volume case Receipt/Invoice were. Still
		needs recording by hand until that's built."""
		if not self.application_fee_amount or self.application_fee_amount <= 0:
			return
		if not self.application_fee_receipt_number:
			return
		if self.application_fee_journal_entry:
			return
		if (self.application_fee_currency or "ZiG") != "ZiG":
			return

		cash_account = frappe.db.get_value("Account", {"account_type": "Asset", "account_name": "Cash-in-Till"})
		income_account = frappe.db.get_value("Account", {"account_type": "Income", "account_name": "Application Fees Income"})
		if not cash_account or not income_account:
			return

		from edupro_school_fees.utils import _create_journal_entry

		je = _create_journal_entry(
			posting_date=nowdate(),
			reference_doctype="Applicant",
			reference_name=self.name,
			lines=[
				{"account": cash_account, "debit": self.application_fee_amount, "credit": 0},
				{"account": income_account, "debit": 0, "credit": self.application_fee_amount},
			],
			remarks=f"Application fee for {self.name} (receipt {self.application_fee_receipt_number})",
		)
		frappe.db.set_value("Applicant", self.name, "application_fee_journal_entry", je.name)


@frappe.whitelist(allow_guest=True)
def submit_application(
	full_legal_name,
	date_of_birth,
	guardian_name,
	guardian_phone,
	gender=None,
	academic_year=None,
	intended_term=None,
	entry_grade=None,
	attendance_type=None,
	guardian_relationship=None,
	guardian_email=None,
):
	"""Public admissions intake -- a prospective parent applies for their
	child's place without an account (FR-ADM-00 style self-service, matching
	how Applicant already exists as a real Bursar-reviewed pipeline; this is
	just its front door). Deliberately a narrow whitelisted method rather than
	exposing the raw Applicant resource endpoint to guests: only the fields a
	parent should be able to set are accepted here, status is always forced to
	"Under Review", and nothing decision-related (status, decision_notes,
	enrolled_student, application_fee_*) is ever settable from this call."""
	if not full_legal_name or not full_legal_name.strip():
		frappe.throw("The child's full name is required.")
	if not guardian_name or not guardian_name.strip():
		frappe.throw("A guardian name is required.")
	if not guardian_phone or not guardian_phone.strip():
		frappe.throw("A guardian phone number is required.")

	if not academic_year:
		academic_year = frappe.db.get_value("Academic Year", {"is_current": 1})
	if not academic_year or not frappe.db.exists("Academic Year", academic_year):
		frappe.throw("No current academic year is configured -- contact the school directly.")

	applicant = frappe.get_doc({
		"doctype": "Applicant",
		"full_legal_name": full_legal_name.strip(),
		"date_of_birth": date_of_birth,
		"gender": gender or None,
		"academic_year": academic_year,
		"intended_term": intended_term or None,
		"entry_grade": entry_grade or None,
		"attendance_type": attendance_type or "Day Scholar",
		"guardian_name": guardian_name.strip(),
		"guardian_relationship": guardian_relationship or None,
		"guardian_phone": guardian_phone.strip(),
		"guardian_email": guardian_email or None,
		"status": "Under Review",
	})
	applicant.insert(ignore_permissions=True)
	frappe.db.commit()
	return applicant.name


@frappe.whitelist()
def enrol_applicant(name, mopse_admission_number=None):
	"""FR-ENR-04: the actual handoff from the admissions pipeline into the real
	Student registry -- Student ID (naming series), entry date, and class
	stream (grade) are all assigned here, plus a Parent Guardian record built
	from the applicant's own contact details. Bursar-only, matching who can
	create a Student directly (Student's own DocPerm).

	DEF-015: this app has no real MoPSE integration to fetch a genuine
	admission number from -- MoPSE issues these, this system can't generate
	one. mopse_admission_number is accepted here (optional) so a Bursar who
	already has it in hand (e.g. from a physical admission register) can
	record it at the one moment they naturally would, instead of it being a
	field that's easy to forget entirely once enrolment is done."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may enrol an applicant.", frappe.PermissionError)

	applicant = frappe.get_doc("Applicant", name)
	if applicant.status != "Accepted":
		frappe.throw("Only an Accepted applicant can be enrolled.")
	if applicant.enrolled_student:
		frappe.throw(f"{applicant.name} has already been enrolled as {applicant.enrolled_student}.")
	if not applicant.beneficiary_category:
		frappe.throw("Set a Beneficiary Category on the applicant before enrolling -- Student requires one.")

	name_parts = applicant.full_legal_name.strip().split(" ", 1)
	first_name = name_parts[0]
	last_name = name_parts[1] if len(name_parts) > 1 else name_parts[0]

	guardian = frappe.get_doc({
		"doctype": "Parent Guardian",
		"full_name": applicant.guardian_name,
		"relationship": applicant.guardian_relationship,
		"phone_number": applicant.guardian_phone,
		"email": applicant.guardian_email,
	}).insert()

	student = frappe.get_doc({
		"doctype": "Student",
		"first_name": first_name,
		"last_name": last_name,
		"date_of_birth": applicant.date_of_birth,
		"gender": applicant.gender,
		"admission_date": nowdate(),
		"academic_year": applicant.academic_year,
		"current_term": applicant.intended_term,
		"grade": applicant.entry_grade,
		"beneficiary_category": applicant.beneficiary_category,
		"guardian": guardian.name,
		"mopse_admission_number": mopse_admission_number,
	}).insert()

	applicant.enrolled_student = student.name
	applicant.enrolled_on = now_datetime()
	applicant.save()

	from edupro_school_fees.utils import _create_audit_log

	_create_audit_log(applicant, action="Applicant Enrolled", justification=f"Enrolled as {student.name}")
	return student.name
