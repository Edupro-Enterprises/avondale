"""Student Profile - the portal's single view of everything on record for a
pupil (personal details, address, parent/guardian, health, sports/clubs,
academics), backing a printable profile page. Reads mostly ride on the
Education app's existing Student/Guardian model; the handful of fields that
model doesn't have (health/emergency/sports/academic notes) are added as
custom fields in install.py:create_student_profile_fields().
"""

import frappe
from frappe import _

PROFILE_FIELDS = [
	"first_name",
	"middle_name",
	"last_name",
	"student_name",
	"image",
	"date_of_birth",
	"gender",
	"blood_group",
	"nationality",
	"student_mobile_number",
	"student_email_id",
	"address_line_1",
	"address_line_2",
	"city",
	"state",
	"pincode",
	"country",
	"emergency_contact_name",
	"emergency_contact_phone",
	"allergies",
	"medical_conditions",
	"sports_and_clubs",
	"academic_notes",
]


@frappe.whitelist()
def get_profile_form_options():
	"""Gender and Country are Link fields on Student, not free text - the
	edit form needs the real set of valid values so it can't submit
	something that fails link validation on save."""
	return {
		"genders": frappe.get_all("Gender", pluck="name", order_by="name"),
		"countries": frappe.get_all("Country", pluck="name", order_by="name"),
	}


@frappe.whitelist()
def get_student_profile(student):
	doc = frappe.get_doc("Student", student)

	data = {f: doc.get(f) for f in PROFILE_FIELDS}
	data["name"] = doc.name
	data["pastel_account_code"] = doc.pastel_account_code

	enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": student},
		fields=["program", "student_batch_name", "academic_year"],
		order_by="academic_year desc",
		limit_page_length=1,
	)
	data["program"] = enrollment[0].program if enrollment else None
	data["student_batch_name"] = enrollment[0].student_batch_name if enrollment else None
	data["academic_year"] = enrollment[0].academic_year if enrollment else None

	guardians = []
	for row in doc.guardians:
		guardian_doc = (
			frappe.db.get_value(
				"Guardian",
				row.guardian,
				["guardian_name", "email_address", "mobile_number", "occupation"],
				as_dict=True,
			)
			if row.guardian
			else None
		)
		guardians.append(
			{
				"guardian": row.guardian,
				"relation": row.relation,
				"guardian_name": (guardian_doc.guardian_name if guardian_doc else row.guardian_name),
				"email_address": guardian_doc.email_address if guardian_doc else None,
				"mobile_number": guardian_doc.mobile_number if guardian_doc else None,
				"occupation": guardian_doc.occupation if guardian_doc else None,
			}
		)
	data["guardians"] = guardians

	data["logs"] = frappe.get_all(
		"Student Log",
		filters={"student": student},
		fields=["type", "date", "log"],
		order_by="date desc",
		limit_page_length=20,
	)

	return data


@frappe.whitelist()
def update_student_profile(
	student,
	date_of_birth=None,
	gender=None,
	blood_group=None,
	nationality=None,
	student_mobile_number=None,
	student_email_id=None,
	address_line_1=None,
	address_line_2=None,
	city=None,
	state=None,
	pincode=None,
	country=None,
	emergency_contact_name=None,
	emergency_contact_phone=None,
	allergies=None,
	medical_conditions=None,
	sports_and_clubs=None,
	academic_notes=None,
):
	frappe.only_for("Bursar")

	doc = frappe.get_doc("Student", student)
	editable_fields = [
		"date_of_birth", "gender", "blood_group", "nationality", "student_mobile_number",
		"student_email_id", "address_line_1", "address_line_2", "city", "state", "pincode",
		"country", "emergency_contact_name", "emergency_contact_phone", "allergies",
		"medical_conditions", "sports_and_clubs", "academic_notes",
	]
	values = locals()
	for fieldname in editable_fields:
		if values.get(fieldname) is not None:
			doc.set(fieldname, values[fieldname])
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return "ok"


@frappe.whitelist()
def update_student_photo(student, file_url):
	frappe.only_for("Bursar")
	frappe.db.set_value("Student", student, "image", file_url)
	frappe.db.commit()
	return "ok"


@frappe.whitelist()
def upsert_guardian(student, relation, guardian_name, email_address=None, mobile_number=None, occupation=None, guardian=None):
	"""Create or update one guardian and (re)link it to the student under the
	given relation slot (Mother/Father/Others) - simple 1-slot-per-relation
	model, matching how a profile form naturally presents "Mother" and
	"Father" as fixed fields rather than an open-ended list."""
	frappe.only_for("Bursar")

	if guardian and frappe.db.exists("Guardian", guardian):
		guardian_doc = frappe.get_doc("Guardian", guardian)
	else:
		guardian_doc = frappe.new_doc("Guardian")

	guardian_doc.guardian_name = guardian_name
	guardian_doc.email_address = email_address
	guardian_doc.mobile_number = mobile_number
	guardian_doc.occupation = occupation
	if guardian_doc.is_new():
		guardian_doc.insert(ignore_permissions=True)
	else:
		guardian_doc.save(ignore_permissions=True)

	student_doc = frappe.get_doc("Student", student)
	existing_row = next((g for g in student_doc.guardians if g.relation == relation), None)
	if existing_row:
		existing_row.guardian = guardian_doc.name
		existing_row.guardian_name = guardian_doc.guardian_name
	else:
		student_doc.append(
			"guardians", {"guardian": guardian_doc.name, "guardian_name": guardian_doc.guardian_name, "relation": relation}
		)
	student_doc.save(ignore_permissions=True)
	frappe.db.commit()
	return guardian_doc.name
