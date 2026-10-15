import frappe
from frappe.model.document import Document
from frappe.utils import flt, now_datetime

DEFAULT_VARIANCE_THRESHOLD = 5.0


class CashUp(Document):
	def validate(self):
		# Once a cash-up has left Draft, it's the fixed record a School Head
		# reviewed (or the flag a lockout is keyed on) -- not editable in place.
		# Only the handover/notes fields, which record what happened afterwards,
		# stay open.
		if self.workflow_state != "Draft":
			doc_before_save = self.get_doc_before_save()
			if doc_before_save:
				before_lines = [(row.payment_method, row.counted_amount) for row in doc_before_save.lines]
				after_lines = [(row.payment_method, row.counted_amount) for row in self.lines]
				if before_lines != after_lines:
					frappe.throw("A submitted cash-up's counted amounts cannot be edited.")

	def is_locked_out(self):
		return self.workflow_state == "Variance Flagged"


def _variance_threshold():
	setup_name = frappe.db.get_value("School Setup", {}, "name")
	if setup_name:
		threshold = frappe.db.get_value("School Setup", setup_name, "cash_up_variance_threshold")
		if threshold:
			return flt(threshold)
	return DEFAULT_VARIANCE_THRESHOLD


def cashier_is_locked_out(user):
	"""FR-CSH-04: a cashier whose most recent cash-up is still Variance Flagged
	cannot record new receipts until a School Head resolves it."""
	return bool(frappe.db.exists("Cash Up", {"cashier": user, "workflow_state": "Variance Flagged"}))


def _system_amount(cashier, cash_up_date, payment_method):
	result = frappe.db.sql(
		"""
		SELECT COALESCE(SUM(amount), 0) FROM `tabReceipt`
		WHERE docstatus = 1 AND received_by = %s AND posting_date = %s AND payment_method = %s
		""",
		(cashier, cash_up_date, payment_method),
	)
	return flt(result[0][0], 2) if result else 0.0


@frappe.whitelist()
def submit_cash_up(name):
	"""Computes each line's system amount and variance, then transitions Draft
	into Balanced or Variance Flagged (FR-CSH-01/03). Flagging is what actually
	triggers the FR-CSH-04 lockout -- see cashier_is_locked_out(), checked from
	Receipt.validate()."""
	doc = frappe.get_doc("Cash Up", name)
	if doc.cashier != frappe.session.user and "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("You can only submit your own cash-up.", frappe.PermissionError)
	if doc.workflow_state != "Draft":
		frappe.throw(f"{doc.name} has already been submitted.")
	if not doc.lines:
		frappe.throw("Add at least one payment method line before submitting.")

	threshold = _variance_threshold()
	flagged = False
	for row in doc.lines:
		row.system_amount = _system_amount(doc.cashier, doc.cash_up_date, row.payment_method)
		row.variance = flt((row.counted_amount or 0) - row.system_amount, 2)
		if abs(row.variance) > threshold:
			flagged = True

	doc.workflow_state = "Variance Flagged" if flagged else "Balanced"
	doc.flags.ignore_permissions = True
	doc.save()

	from edupro_school_fees.utils import _create_audit_log

	_create_audit_log(
		doc,
		action="Cash-Up Variance Flagged" if flagged else "Cash-Up Balanced",
		justification=f"Threshold {threshold}; " + ", ".join(f"{r.payment_method}: {r.variance}" for r in doc.lines),
	)
	return _serialize(doc)


@frappe.whitelist()
def resolve_cash_up(name, notes=None):
	"""Only a School Head can lift a lockout -- matching the same
	Bursar-drafts/senior-role-approves shape used for the receipt reversal
	workflow and MoPSE ED46 certification."""
	if "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only School Head may resolve a flagged cash-up.", frappe.PermissionError)

	doc = frappe.get_doc("Cash Up", name)
	if doc.workflow_state != "Variance Flagged":
		frappe.throw(f"{doc.name} is not currently flagged.")

	doc.flags.ignore_permissions = True
	if notes:
		doc.notes = f"{doc.notes}\n{notes}" if doc.notes else notes
	doc.workflow_state = "Resolved"
	doc.reviewed_by = frappe.session.user
	doc.reviewed_on = now_datetime()
	doc.save()
	return _serialize(doc)


def _serialize(doc):
	return {
		"name": doc.name,
		"cashier": doc.cashier,
		"cash_up_date": doc.cash_up_date,
		"workflow_state": doc.workflow_state,
		"notes": doc.notes,
		"lines": [
			{
				"payment_method": row.payment_method,
				"system_amount": row.system_amount,
				"counted_amount": row.counted_amount,
				"variance": row.variance,
			}
			for row in doc.lines
		],
	}


@frappe.whitelist()
def list_flagged_cash_ups():
	"""The queue a School Head resolves from -- everyone's Variance Flagged
	cash-ups, with enough line detail to review without a second fetch."""
	if "School Head" not in frappe.get_roles(frappe.session.user) and "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Not permitted.", frappe.PermissionError)

	names = frappe.get_all("Cash Up", filters={"workflow_state": "Variance Flagged"}, pluck="name", order_by="cash_up_date asc")
	return [_serialize(frappe.get_doc("Cash Up", name)) for name in names]
