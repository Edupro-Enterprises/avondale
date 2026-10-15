import frappe
from frappe.model.document import Document
from frappe.utils import add_days, flt, now_datetime


class PeriodLock(Document):
	def validate(self):
		if self.status == "Closed" and not self.closed_on:
			frappe.throw("Use close_period() to close a period, not a direct save.")


@frappe.whitelist()
def confirm_audit_for_period_lock(period_lock, audit_confirmation_document=None):
	"""DEF-007: close_period() used to have no evidence-of-audit gate at all
	-- any School Head could close a period unilaterally, despite a District
	Education Auditor/Inspector role existing elsewhere in the app. Their
	DocPerm on Period Lock is read-only by design (an external oversight
	role, not an internal approver), so this narrowly elevates just this one
	field-set, the same pattern already used by
	approve_receipt_reversal/co_sign_sensitive_procurement."""
	if "District Education Auditor/Inspector" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a District Education Auditor/Inspector may confirm a period's audit.", frappe.PermissionError)

	doc = frappe.get_doc("Period Lock", period_lock)
	if doc.status == "Closed":
		frappe.throw(f"{doc.name} is already Closed.")
	if doc.audit_confirmed_by:
		frappe.throw(f"{doc.name}'s audit has already been confirmed by {doc.audit_confirmed_by}.")

	doc.flags.ignore_permissions = True
	if audit_confirmation_document:
		doc.audit_confirmation_document = audit_confirmation_document
	doc.audit_confirmed_by = frappe.session.user
	doc.audit_confirmed_on = now_datetime()
	doc.save()

	from edupro_school_fees.utils import _create_audit_log
	_create_audit_log(doc, action=f"Audit confirmed for {doc.name}")
	return doc.name


@frappe.whitelist()
def close_period(period_lock):
	"""Posts the year-end closing Journal Entry (Income/Expense accounts for
	the period zeroed into the 'Accumulated Fund' Equity account) and locks
	every posting date on or before closing_date against any further Journal
	Entry (see utils._create_journal_entry). School Head only -- the same
	final-sign-off authority as every other closing gate in this app -- and
	only after a District Education Auditor/Inspector has confirmed the
	period's audit via confirm_audit_for_period_lock() (DEF-007)."""
	if "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only School Head may close a period.", frappe.PermissionError)

	doc = frappe.get_doc("Period Lock", period_lock)
	if doc.status == "Closed":
		frappe.throw(f"{doc.name} is already Closed.")
	if not doc.audit_confirmed_by:
		frappe.throw(
			f"{doc.name} cannot be closed until a District Education Auditor/Inspector has confirmed "
			"the audit via confirm_audit_for_period_lock()."
		)

	# DEF-022: the chronological-order guard below normally comes for free
	# via _create_journal_entry()'s own closed-period check -- but that's
	# only called when `lines` is non-empty, so a period whose net Income -
	# Expense happens to be exactly zero (no closing JE ever posted) silently
	# skipped it, letting periods be closed out of order. Checked directly
	# here so it applies unconditionally, matching _latest_closed_period_date().
	from edupro_school_fees.utils import _latest_closed_period_date
	locked_through = _latest_closed_period_date()
	if locked_through and doc.closing_date <= locked_through:
		frappe.throw(
			f"Closing date {doc.closing_date} falls on or before an already-closed period "
			f"(locked through {locked_through}). Periods must be closed in chronological order."
		)

	prior_close = frappe.db.get_value(
		"Period Lock", {"status": "Closed", "closing_date": ["<", doc.closing_date]},
		"closing_date", order_by="closing_date desc",
	)
	period_start = add_days(prior_close, 1) if prior_close else "1900-01-01"

	from edupro_school_fees.reports import _account_totals
	rows = _account_totals("je.posting_date between %s and %s", (period_start, doc.closing_date))

	lines = []
	net = 0.0
	for row in rows:
		if row.account_type == "Income":
			balance = flt(row.credit - row.debit, 2)
			if balance:
				lines.append({"account": row.account, "debit": balance, "credit": 0})
				net += balance
		elif row.account_type == "Expense":
			balance = flt(row.debit - row.credit, 2)
			if balance:
				lines.append({"account": row.account, "debit": 0, "credit": balance})
				net -= balance
	net = flt(net, 2)

	if lines:
		equity_account = frappe.db.get_value("Account", {"account_type": "Equity", "account_name": "Accumulated Fund"})
		if not equity_account:
			frappe.throw("An 'Accumulated Fund' Equity account must exist before a period can be closed.")
		if net > 0:
			lines.append({"account": equity_account, "debit": 0, "credit": net})
		elif net < 0:
			lines.append({"account": equity_account, "debit": -net, "credit": 0})

		from edupro_school_fees.utils import _create_journal_entry
		_create_journal_entry(
			posting_date=doc.closing_date,
			reference_doctype="Period Lock",
			reference_name=doc.name,
			lines=lines,
			remarks=f"Year-end closing for {doc.name} ({period_start} to {doc.closing_date})",
		)

	doc.flags.ignore_permissions = True
	doc.status = "Closed"
	doc.net_surplus_deficit = net
	doc.closed_by = frappe.session.user
	doc.closed_on = now_datetime()
	doc.save()

	from edupro_school_fees.utils import _create_audit_log
	_create_audit_log(doc, action=f"Period closed through {doc.closing_date}: net {net}")
	return doc.name
