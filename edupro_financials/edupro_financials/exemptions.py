"""Student Exemptions & Waivers Entry - BEAM allocations, staff child
discounts, and SDC hardship waivers, each requiring supporting evidence
before the record can even be created. The doctype's own `supporting_document`
field is already mandatory (reqd=1) at the schema level, so "must upload
before saving" isn't something this module enforces separately - Frappe's
own mandatory-field check on insert() already refuses to save without it.
The frontend just has to upload the file *first* (getting a file_url back)
and only then call create_exemption with that url already in hand.
"""

import frappe
from frappe import _
from frappe.utils import flt


@frappe.whitelist()
def get_form_options():
	return {
		"exemption_types": ["BEAM", "Staff Discount", "Hardship"],
	}


@frappe.whitelist()
def search_students(query=None, limit=20):
	conditions = {}
	filters = []
	values = {"limit": int(limit)}
	where = "1=1"
	if query:
		where = "(student_name like %(q)s or name like %(q)s)"
		values["q"] = f"%{query}%"

	return frappe.db.sql(
		f"""
		select name, student_name
		from `tabStudent`
		where {where}
		order by student_name asc
		limit %(limit)s
		""",
		values,
		as_dict=True,
	)


@frappe.whitelist()
def create_exemption(
	student,
	exemption_type,
	approval_minutes_ref,
	supporting_document,
	discount_percentage=0,
	amount_covered=0,
	submit=1,
):
	if not supporting_document:
		frappe.throw(_("Supporting document is required before this record can be saved."))

	doc = frappe.get_doc(
		{
			"doctype": "Student Exemption and Discount",
			"student": student,
			"exemption_type": exemption_type,
			"approval_minutes_ref": approval_minutes_ref,
			"discount_percentage": flt(discount_percentage),
			"amount_covered": flt(amount_covered),
			"supporting_document": supporting_document,
		}
	)
	doc.insert(ignore_permissions=True)
	if int(submit):
		doc.submit()
	frappe.db.commit()
	return doc.name


@frappe.whitelist()
def list_exemptions(limit=200):
	rows = frappe.get_all(
		"Student Exemption and Discount",
		fields=[
			"name", "student", "exemption_type", "approval_minutes_ref",
			"discount_percentage", "amount_covered", "docstatus", "supporting_document", "creation",
		],
		order_by="creation desc",
		limit_page_length=int(limit),
	)
	students = {s.name: s.student_name for s in frappe.get_all("Student", fields=["name", "student_name"])}
	for row in rows:
		row["student_name"] = students.get(row.student)
	return rows
