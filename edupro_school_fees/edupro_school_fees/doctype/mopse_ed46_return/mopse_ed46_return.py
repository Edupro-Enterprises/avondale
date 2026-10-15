import frappe
from frappe.model.document import Document
from frappe.utils import flt, now_datetime


class MoPSEED46Return(Document):
	def validate(self):
		all_certified = self.bursar_certified and self.school_head_certified and self.sdc_certified
		if all_certified and self.workflow_state != "Certified":
			self.workflow_state = "Certified"
			self.certified_on = now_datetime()
		elif not all_certified and self.workflow_state == "Certified":
			# A certification was reversed after the fact -- fall back rather than
			# leave a stale "Certified" state next to an incomplete sign-off set.
			self.workflow_state = "Pending Certification"
			self.certified_on = None
		elif not all_certified and (self.bursar_certified or self.school_head_certified or self.sdc_certified):
			self.workflow_state = "Pending Certification"


def _school_header():
	setup_name = frappe.db.get_value("School Setup", {}, "name")
	if not setup_name:
		frappe.throw("School Setup must be completed before an ED46 Return can be generated.")
	return frappe.get_doc("School Setup", setup_name)


@frappe.whitelist()
def generate_ed46_return(term):
	"""Creates (or refreshes, if still Draft/Pending Certification) the ED46
	Return for this term: snapshots the School Setup header and computes
	enrolment/levy/revenue figures fresh from the current roster and ledger.
	Refuses to touch an already-Certified return -- a statutory return is a
	fixed point in time once signed off, not something that silently redrifts
	if the ledger changes afterwards."""
	from edupro_school_fees.reports import _log_report_generated, _require_internal_role

	_require_internal_role()
	_log_report_generated("MoPSE ED46 Termly Return", f" ({term})")

	existing = frappe.db.exists("MoPSE ED46 Return", {"term": term})
	if existing:
		doc = frappe.get_doc("MoPSE ED46 Return", existing)
		if doc.workflow_state == "Certified":
			frappe.throw(f"{doc.name} is already Certified -- figures are fixed as at certification.")
	else:
		doc = frappe.new_doc("MoPSE ED46 Return")
		doc.term = term

	term_doc = frappe.get_doc("Term", term)
	setup = _school_header()

	doc.school_name = setup.school_name
	doc.registration_number = setup.registration_number
	doc.emis_number = setup.emis_number
	doc.school_code = setup.school_code
	doc.physical_address = setup.physical_address
	doc.district = setup.district
	doc.region = setup.region

	doc.total_enrolment = frappe.db.count("Student", {"academic_year": term_doc.academic_year, "status": "Active"})

	invoices = frappe.get_all("Invoice", filters={"term": term, "docstatus": 1}, fields=["total_amount"])
	doc.total_revenue_billed = flt(sum(row.total_amount for row in invoices), 2)
	doc.levy_base_amount = doc.total_revenue_billed

	realized = frappe.db.sql(
		"""
		SELECT COALESCE(SUM(r.amount), 0)
		FROM `tabReceipt` r
		INNER JOIN `tabInvoice` i ON i.name = r.invoice
		WHERE r.docstatus = 1 AND i.term = %s
		""",
		(term,),
	)
	doc.total_revenue_realized = flt(realized[0][0], 2) if realized else 0

	if doc.is_new():
		doc.insert()
	else:
		doc.save()
	return doc.name


def _certify(name, field, role):
	doc = frappe.get_doc("MoPSE ED46 Return", name)
	if doc.workflow_state == "Certified":
		frappe.throw(f"{doc.name} is already fully Certified.")
	if role not in frappe.get_roles(frappe.session.user):
		frappe.throw(f"Only {role} may certify this return in that capacity.", frappe.PermissionError)

	frappe.db.set_value("MoPSE ED46 Return", name, field, 1)
	doc.reload()
	doc.save(ignore_permissions=True)


@frappe.whitelist()
def certify_as_bursar(name):
	_certify(name, "bursar_certified", "Bursar")


@frappe.whitelist()
def certify_as_school_head(name):
	_certify(name, "school_head_certified", "School Head")


@frappe.whitelist()
def certify_as_sdc_chair(name):
	_certify(name, "sdc_certified", "SDC Chairperson/Treasurer")
