import frappe
from frappe.model.document import Document
from frappe.utils import flt


class BEAMClaim(Document):
	def validate(self):
		if self.treasury_amount_disbursed and flt(self.treasury_amount_disbursed) < 0:
			frappe.throw("Treasury Amount Disbursed cannot be negative.")
		self._validate_against_linked_invoice()

	def _validate_against_linked_invoice(self):
		"""DEF-011: BEAM Claim had no link to Invoice at all -- a Bursar could
		claim tuition/levy arrears that were never actually billed, or that
		don't match what was. Optional (existing claims predate this field),
		but when an Invoice is linked, the claimed total must not exceed what
		was actually billed on it, and it must be the same student's invoice."""
		if not self.invoice:
			return

		invoice = frappe.db.get_value("Invoice", self.invoice, ["student", "total_amount"], as_dict=True)
		if not invoice:
			frappe.throw(f"{self.invoice} does not exist.")
		if invoice.student != self.student:
			frappe.throw(f"{self.invoice} belongs to {invoice.student}, not {self.student}.")

		claimed = flt(self.tuition_arrears_claimed) + flt(self.sdc_levy_arrears_claimed)
		if flt(claimed, 2) > flt(invoice.total_amount, 2):
			frappe.throw(
				f"Amount claimed ({claimed}) exceeds {self.invoice}'s total billed amount "
				f"({invoice.total_amount}) -- a BEAM claim cannot exceed what was actually invoiced."
			)


@frappe.whitelist()
def get_beam_reconciliation(term=None):
	"""Per-claim rows plus a running cumulative_unpaid_claim per student (a
	student can have more than one claim across terms) -- exactly the shape
	FR-BEAM-02 names, joined against Student for name/grade since BEAM Claim
	only stores the Link."""
	from edupro_school_fees.reports import _log_report_generated, _require_internal_role

	_require_internal_role()
	_log_report_generated("BEAM Claims Reconciliation", f" ({term})" if term else "")

	filters = {"term": term} if term else {}
	claims = frappe.get_all(
		"BEAM Claim",
		filters=filters,
		fields=[
			"name", "student", "term", "claim_date",
			"tuition_arrears_claimed", "sdc_levy_arrears_claimed", "treasury_amount_disbursed",
		],
		order_by="claim_date asc",
	)

	student_ids = list({row.student for row in claims})
	students = {}
	if student_ids:
		for row in frappe.get_all(
			"Student", filters={"name": ["in", student_ids]}, fields=["name", "first_name", "last_name", "grade"]
		):
			students[row.name] = row

	cumulative_by_student = {}
	rows = []
	for claim in claims:
		claimed = flt(claim.tuition_arrears_claimed) + flt(claim.sdc_levy_arrears_claimed)
		unpaid = flt(claimed - flt(claim.treasury_amount_disbursed), 2)
		cumulative_by_student[claim.student] = flt(cumulative_by_student.get(claim.student, 0) + unpaid, 2)

		student = students.get(claim.student, {})
		rows.append({
			"name": claim.name,
			"student": claim.student,
			"student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() or claim.student,
			"grade": student.get("grade"),
			"term": claim.term,
			"claim_date": claim.claim_date,
			"tuition_arrears_claimed": flt(claim.tuition_arrears_claimed, 2),
			"sdc_levy_arrears_claimed": flt(claim.sdc_levy_arrears_claimed, 2),
			"treasury_amount_disbursed": flt(claim.treasury_amount_disbursed, 2),
			"unpaid_claim": unpaid,
		})

	for row in rows:
		row["cumulative_unpaid_claim"] = cumulative_by_student.get(row["student"], 0)

	totals = {
		"total_tuition_claimed": flt(sum(r["tuition_arrears_claimed"] for r in rows), 2),
		"total_sdc_levy_claimed": flt(sum(r["sdc_levy_arrears_claimed"] for r in rows), 2),
		"total_disbursed": flt(sum(r["treasury_amount_disbursed"] for r in rows), 2),
		"total_unpaid": flt(sum(r["unpaid_claim"] for r in rows), 2),
	}

	return {"rows": sorted(rows, key=lambda r: r["student_name"]), "totals": totals}
