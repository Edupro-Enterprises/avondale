import frappe
from frappe.model.document import Document
from frappe.utils import flt, getdate, nowdate


class Invoice(Document):
	def before_insert(self):
		# FR-FEE-08: prior-term debt is carried onto the new invoice automatically,
		# rather than sitting on old invoices a Bursar has to remember to chase
		# separately. See _carry_forward_prior_balances() for how this avoids
		# double-recognizing income already booked when the old debt was created.
		self._carry_forward_prior_balances()
		# Runs after the above so a student's unapplied advance can also cover
		# brought-forward debt, not just this invoice's own new charges -- see
		# _apply_available_advance() for why that's still GL-correct.
		self._apply_available_advance()

	def validate(self):
		if self.fee_structure and frappe.db.get_value("Fee Structure", self.fee_structure, "workflow_state") != "Approved":
			frappe.throw("Cannot invoice against a Fee Structure that is not Approved.")

		self._resolve_beneficiary_categories()

		self.total_amount = sum(row.amount or 0 for row in self.items)
		if self.is_new() or not self.outstanding_amount:
			self.outstanding_amount = self.total_amount

	def _resolve_beneficiary_categories(self):
		"""DEF-008: each line's funding source -- resolved from the matching Fee
		Structure Item's own override (Fee Structure Item.beneficiary_category),
		or the Fee Structure's overall category otherwise -- so one invoice can
		mix e.g. BEAM-funded and parent-funded lines instead of every line
		being forced to share a single structure-wide category. Covers both
		manually-created invoices and run_batch_invoicing() uniformly, since
		both funnel through this same validate()."""
		if not self.fee_structure:
			return
		fs = frappe.get_cached_doc("Fee Structure", self.fee_structure)
		per_item = {row.fee_item: row.beneficiary_category for row in fs.items if row.beneficiary_category}
		for row in self.items:
			if not row.beneficiary_category:
				row.beneficiary_category = per_item.get(row.fee_item) or fs.beneficiary_category

	def after_insert(self):
		for prior_name in self.flags.get("prior_invoices_to_consolidate") or []:
			frappe.db.set_value("Invoice", prior_name, {"outstanding_amount": 0, "status": "Consolidated"})

		for receipt_name, amount_taken in self.flags.get("advances_to_consume") or []:
			remaining = frappe.db.get_value("Receipt", receipt_name, "advance_remaining")
			frappe.db.set_value("Receipt", receipt_name, "advance_remaining", flt((remaining or 0) - amount_taken, 2))

	def _carry_forward_prior_balances(self):
		if not self.student:
			return
		prior = frappe.get_all(
			"Invoice",
			filters={
				"student": self.student, "docstatus": 1, "outstanding_amount": [">", 0],
				"status": ["!=", "Consolidated"],
			},
			fields=["name", "outstanding_amount"],
		)
		if not prior:
			return

		total_prior = flt(sum(row.outstanding_amount for row in prior), 2)
		self.append("items", {
			"fee_item": _ensure_brought_forward_fee_item(),
			"description": f"Balance brought forward ({len(prior)} invoice(s))",
			"amount": total_prior,
			"is_brought_forward": 1,
		})
		self.flags.prior_invoices_to_consolidate = [row.name for row in prior]

	def _apply_available_advance(self):
		"""A student's unapplied Advance Receipt(s) (payer paid ahead, with no
		invoice to apply against at the time -- see record_payment_with_allocation())
		are consumed here, oldest first, against whatever this new invoice charges
		(including any brought-forward line just appended above). Recorded as a
		negative Invoice Line rather than silently reducing outstanding_amount, so
		the invoice itself shows why less is owed. create_journal_entry_for_invoice()
		still recognizes the invoice's full new-charge total as Income -- this line
		only ever affects the Debtors side, releasing the Unearned Revenue booked
		when the advance was originally receipted."""
		if not self.student:
			return

		advances = frappe.get_all(
			"Receipt",
			filters={
				"student": self.student, "allocation_type": "Advance", "docstatus": 1,
				"advance_remaining": [">", 0],
			},
			fields=["name", "advance_remaining"],
			order_by="posting_date asc, creation asc",
		)
		if not advances:
			return

		charges_so_far = flt(sum(row.amount or 0 for row in self.items), 2)
		if charges_so_far <= 0:
			return

		remaining_to_absorb = charges_so_far
		consumed = []
		for row in advances:
			if remaining_to_absorb <= 0:
				break
			take = min(flt(row.advance_remaining, 2), remaining_to_absorb)
			if take <= 0:
				continue
			consumed.append((row.name, take))
			remaining_to_absorb = flt(remaining_to_absorb - take, 2)

		total_applied = flt(sum(amount for _, amount in consumed), 2)
		if total_applied <= 0:
			return

		self.append("items", {
			"fee_item": _ensure_advance_applied_fee_item(),
			"description": f"Advance payment applied ({len(consumed)} receipt(s))",
			"amount": -total_applied,
			"is_advance_applied": 1,
		})
		self.flags.advances_to_consume = consumed

	def on_trash(self):
		# Once an Invoice has ever been submitted, it is part of the ledger trail --
		# cancelling it (docstatus 1 -> 2) must not also allow it to then be deleted
		# outright, which would erase it from every statement with no record it ever
		# existed. A never-submitted Draft (docstatus 0) is not yet part of anything
		# and may still be deleted normally.
		if self.docstatus != 0:
			frappe.throw(
				"A submitted Invoice cannot be deleted, even after cancellation. "
				"It remains part of the audit trail."
			)

	def on_cancel(self):
		from edupro_school_fees.utils import _create_audit_log

		_create_audit_log(self, action="Invoice Cancelled")


def _ensure_brought_forward_fee_item():
	name = "Balance Brought Forward"
	if not frappe.db.exists("Fee Item", name):
		debtors_account = frappe.db.get_value("Account", {"account_type": "Asset", "account_name": "Debtors"})
		if not debtors_account:
			frappe.throw("A Debtors account must exist before a prior balance can be carried forward.")
		frappe.get_doc({
			"doctype": "Fee Item", "item_name": name, "account": debtors_account, "default_amount": 0,
		}).insert(ignore_permissions=True)
	return name


def _ensure_advance_applied_fee_item():
	name = "Advance Payment Applied"
	if not frappe.db.exists("Fee Item", name):
		debtors_account = frappe.db.get_value("Account", {"account_type": "Asset", "account_name": "Debtors"})
		if not debtors_account:
			frappe.throw("A Debtors account must exist before an advance payment can be applied.")
		frappe.get_doc({
			"doctype": "Fee Item", "item_name": name, "account": debtors_account, "default_amount": 0,
		}).insert(ignore_permissions=True)
	return name


def _pro_rata_multiplier(admission_date, term_start, term_end):
	"""1.0 for a student already enrolled by the start of the term (the normal
	case); a fraction of the term's remaining days for a mid-term admission
	(FR-INV-04); 0 for an admission date after the term has already ended
	(shouldn't normally be selected into a batch, but never bill for a term a
	student wasn't there for at all)."""
	admission_date = getdate(admission_date)
	term_start = getdate(term_start)
	term_end = getdate(term_end)

	if admission_date <= term_start:
		return 1.0
	if admission_date > term_end:
		return 0.0

	total_days = (term_end - term_start).days + 1
	remaining_days = (term_end - admission_date).days + 1
	return remaining_days / total_days if total_days > 0 else 1.0


@frappe.whitelist()
def run_batch_invoicing(fee_structure, grade=None):
	"""Invoices every eligible Active student against an Approved Fee Structure
	in one call (FR-INV-01) -- whole school by default, or narrowed to one
	grade/class. A student admitted partway through the term is billed
	pro-rata for the term's remaining days (FR-INV-04); one already enrolled
	before the term started is billed in full. A student already invoiced
	against this exact Fee Structure is skipped, not re-billed, so a run can
	always be safely repeated (e.g. after adding new admissions) without
	double-invoicing anyone already covered. Each student's invoice commits
	independently, so one student's failure doesn't roll back the students
	already successfully invoiced earlier in the same run."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may run batch invoicing.", frappe.PermissionError)

	fs = frappe.get_doc("Fee Structure", fee_structure)
	if fs.workflow_state != "Approved":
		frappe.throw(f"{fs.name} is not Approved -- cannot invoice against it.")

	term = frappe.get_doc("Term", fs.term)

	filters = {"academic_year": fs.academic_year, "status": "Active"}
	if fs.beneficiary_category:
		filters["beneficiary_category"] = fs.beneficiary_category
	if grade:
		filters["grade"] = grade

	students = frappe.get_all("Student", filters=filters, fields=["name", "admission_date"])

	created, skipped, failed = [], [], []
	for student in students:
		try:
			# DEF-010: the exists-check below and the insert() further down are
			# not atomic on their own -- two overlapping runs (a scheduled retry
			# racing a manual re-run, or two Bursar sessions) could both pass the
			# exists-check for the same student before either commits, producing
			# two distinct, validly-numbered invoices for one billing cycle.
			# Locking the Student row for the rest of this iteration serializes
			# any concurrent attempt to invoice the *same* student, without
			# blocking other students' rows -- released at the frappe.db.commit()
			# a few lines below (or the rollback on failure).
			frappe.db.get_value("Student", student.name, "name", for_update=True)
			if frappe.db.exists("Invoice", {"student": student.name, "fee_structure": fs.name}):
				skipped.append(student.name)
				frappe.db.commit()
				continue

			multiplier = _pro_rata_multiplier(student.admission_date, term.start_date, term.end_date)
			items = [
				{
					"fee_item": row.fee_item,
					"description": f"{row.fee_item} (pro-rated {multiplier:.0%} of term)" if multiplier < 1 else None,
					"amount": flt((row.amount or 0) * multiplier, 2),
				}
				for row in fs.items
			]
			invoice = frappe.get_doc({
				"doctype": "Invoice",
				"student": student.name,
				"fee_structure": fs.name,
				"posting_date": nowdate(),
				"items": items,
			})
			invoice.insert()
			invoice.submit()
			frappe.db.commit()
			created.append({"invoice": invoice.name, "student": student.name})
		except Exception as e:
			frappe.db.rollback()
			failed.append({"student": student.name, "error": str(e)})

	return {"created": created, "skipped_existing": skipped, "failed": failed}


@frappe.whitelist()
def email_invoices(invoice_names):
	"""FR-INV-05: emails each of these already-generated Invoices (as a PDF
	attachment) to its student's guardian -- the Batch Invoicing page's
	"Email all" action, called with a single name for one-off use too."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may email invoices.", frappe.PermissionError)

	from edupro_school_fees.notifications import email_invoice_document

	if isinstance(invoice_names, str):
		invoice_names = frappe.parse_json(invoice_names)

	sent, skipped = [], []
	for name in invoice_names:
		invoice = frappe.get_doc("Invoice", name)
		if email_invoice_document(invoice):
			sent.append(name)
		else:
			skipped.append(name)
	return {"sent": sent, "skipped_no_guardian_email": skipped}
