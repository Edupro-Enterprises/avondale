import frappe
from frappe.model.document import Document
from frappe.utils import flt


class JournalEntry(Document):
	def validate(self):
		# DEF-QA3-001: summing raw floats (each already flt(x, 2)-rounded
		# individually by whichever caller built these lines) can still land
		# on a binary floating-point artifact a few ULPs off round -- e.g.
		# 323.96 vs 323.96000000000004 -- even though the entry is genuinely
		# balanced. A strict != on unrounded sums rejected real, correctly-
		# balanced entries (found live: an invoice combining a pro-rated
		# charge with a carry-forward line). Round the totals themselves to
		# money precision before comparing, the same flt(x, 2) convention
		# used everywhere else in this app's money arithmetic.
		self.total_debit = flt(sum(row.debit or 0 for row in self.entries), 2)
		self.total_credit = flt(sum(row.credit or 0 for row in self.entries), 2)
		if self.total_debit != self.total_credit:
			frappe.throw(
				f"Journal Entry is not balanced: total debit {self.total_debit} != total credit {self.total_credit}"
			)

	def on_trash(self):
		# The general ledger is append-only: a submitted Journal Entry that is later
		# cancelled must still not be deletable outright, or every statement built
		# from it loses any record it ever existed.
		if self.docstatus != 0:
			frappe.throw(
				"A submitted Journal Entry cannot be deleted, even after cancellation. "
				"It remains part of the general ledger's audit trail."
			)

	def on_cancel(self):
		from edupro_school_fees.utils import _create_audit_log

		_create_audit_log(self, action="Journal Entry Cancelled")


@frappe.whitelist()
def reverse_journal_entry(journal_entry, reason):
	"""DEF-017: only Receipt had a guided reversal flow -- correcting a
	Cashbook Payment, Credit Note, Asset depreciation, or any other posting
	meant manually keying an unlinked compensating entry by hand, with
	nothing connecting it back to what it was correcting. School Head only,
	the same authorized-supervisor bar as Receipt's reversal approval and
	Credit Note's approval -- reversing a ledger entry is exactly that kind
	of action."""
	if "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only School Head may reverse a Journal Entry.", frappe.PermissionError)
	if not reason:
		frappe.throw("A reason is required to reverse a Journal Entry.")

	original = frappe.get_doc("Journal Entry", journal_entry)
	if original.docstatus != 1:
		frappe.throw(f"{original.name} is not a submitted Journal Entry.")
	if original.reversed_by:
		frappe.throw(f"{original.name} has already been reversed by {original.reversed_by}.")
	if original.reversal_of:
		frappe.throw(f"{original.name} is itself a reversal and cannot be reversed again.")

	from frappe.utils import nowdate

	lines = [
		{"account": row.account, "debit": row.credit, "credit": row.debit, "exchange_rate": row.exchange_rate}
		for row in original.entries
	]

	from edupro_school_fees.utils import _create_audit_log, _create_journal_entry

	reversal = _create_journal_entry(
		posting_date=nowdate(),
		reference_doctype=original.reference_doctype,
		reference_name=original.reference_name,
		lines=lines,
		remarks=f"Reversal of {original.name}: {reason}",
		fund_override=original.fund,
		extra_fields={"reversal_of": original.name, "reversal_reason": reason},
	)

	frappe.db.set_value("Journal Entry", original.name, "reversed_by", reversal.name)

	_create_audit_log(reversal, action=f"Journal Entry {original.name} reversed", justification=reason)
	return reversal.name
