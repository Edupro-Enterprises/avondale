"""Un-gapable sequential receipt numbering (spec section 5.3).

Format: REC-{TERMINAL}-{YYYY}-{#####}, sequential per terminal per year,
allocated via Frappe's own series counter so concurrent submissions can't
collide or double-allocate a number.
"""

import re

import frappe
from frappe.model.naming import make_autoname
from frappe.utils import flt, fmt_money, getdate

RECEIPT_PATTERN = re.compile(r"^REC-(?P<terminal>[A-Z0-9]+)-(?P<year>\d{4})-(?P<seq>\d{5})$")


def assign_receipt_number(doc, method):
	if doc.get("receipt_no") or doc.get("is_opening_balance"):
		return

	# A Fees record can be submitted purely as a bill (term invoicing, no
	# money collected yet) - outstanding_amount still equals grand_total in
	# that case. "Sequential Official Cash Receipts" (spec 5.3) means a
	# receipt number is issued for cash actually received, not for the act
	# of billing - so skip numbering here and let it be assigned later, at
	# whatever point payment is actually recorded against this invoice.
	if flt(doc.outstanding_amount) >= flt(doc.grand_total) - 0.005:
		return

	terminal = (doc.get("terminal") or "HAR").upper()
	year = getdate(doc.posting_date).year

	receipt_no = make_autoname(f"REC-{terminal}-{year}-.#####")
	doc.db_set("receipt_no", receipt_no, update_modified=False)


def assign_receipt_number_to_payment(doc, method):
	"""Every submitted Receive-type Payment Entry represents real money
	collected right now - unlike Fees.on_submit (fires at *billing* time,
	before anything's paid) this fires at the actual moment of receipting,
	so unconditionally numbers every one rather than checking outstanding
	vs grand_total first."""
	if doc.get("receipt_no") or doc.payment_type != "Receive":
		return

	terminal = (doc.get("terminal") or "HAR").upper()
	year = getdate(doc.posting_date).year

	receipt_no = make_autoname(f"REC-{terminal}-{year}-.#####")
	doc.db_set("receipt_no", receipt_no, update_modified=False)


def attach_combined_fee_context(doc, method, print_settings=None):
	"""A student's term bill is deliberately split across two Fees records
	(Levy on the SDC/SDA fund, Tuition on the Tuition/Government fund) so
	each posts to the correct fund in the GL - but a parent looking at a
	receipt shouldn't have to reconcile two separate pieces of paper to
	find out they owe $170, not $150. This runs on before_print (wired in
	hooks.py) and attaches the sibling invoice's line + a combined total
	onto the in-memory doc, purely for rendering - nothing is persisted."""
	doc.combined_components = list(doc.components)
	for row in doc.combined_components:
		row.fund = doc.fund
	combined_grand_total = flt(doc.grand_total)
	combined_outstanding = flt(doc.outstanding_amount)

	if doc.student and doc.academic_term:
		siblings = frappe.get_all(
			"Fees",
			filters={
				"student": doc.student,
				"academic_term": doc.academic_term,
				"name": ["!=", doc.name],
				"docstatus": 1,
				"fee_structure": ["!=", doc.fee_structure],
			},
			fields=["name"],
		)
		for sibling in siblings:
			sib_doc = frappe.get_cached_doc("Fees", sibling.name)
			sib_components = list(sib_doc.components)
			for row in sib_components:
				row.fund = sib_doc.fund
			doc.combined_components += sib_components
			combined_grand_total += flt(sib_doc.grand_total)
			combined_outstanding += flt(sib_doc.outstanding_amount)

	doc.combined_grand_total = combined_grand_total
	doc.combined_outstanding = combined_outstanding
	doc.combined_grand_total_formatted = fmt_money(combined_grand_total, currency=doc.currency)
	doc.combined_outstanding_formatted = fmt_money(combined_outstanding, currency=doc.currency)


def get_receipt_sequence_gaps(doctypes=("Fees", "Sales Invoice", "Payment Entry")):
	"""Return missing receipt numbers per terminal/year - any gap means a
	receipt was skipped, deleted outside the app, or renumbered - all of
	which should raise an Auditor Alert per spec section 5.3.

	The REC-{terminal}-{year}-{seq} counter is a single global sequence
	(Frappe's autoname series counter is keyed by the naming template, not
	scoped per doctype) shared across every doctype that calls
	assign_receipt_number* - Fees and Sales Invoice for atomic POS-style
	sales, Payment Entry for fees paid after the fact. Checking any one
	doctype's numbers in isolation would misreport numbers legitimately
	used by another as "gaps" - all three have to be combined first.
	"""
	if isinstance(doctypes, str):
		doctypes = (doctypes,)

	rows = []
	for doctype in doctypes:
		rows.extend(
			frappe.get_all(
				doctype,
				filters={"receipt_no": ["like", "REC-%"]},
				fields=["name", "receipt_no"],
			)
		)

	by_bucket = {}
	for row in rows:
		match = RECEIPT_PATTERN.match(row.receipt_no or "")
		if not match:
			continue
		bucket = (match.group("terminal"), match.group("year"))
		by_bucket.setdefault(bucket, set()).add(int(match.group("seq")))

	gaps = []
	for (terminal, year), seqs in by_bucket.items():
		if not seqs:
			continue
		expected = set(range(1, max(seqs) + 1))
		missing = sorted(expected - seqs)
		for seq in missing:
			gaps.append(
				{
					"terminal": terminal,
					"year": year,
					"missing_receipt_no": f"REC-{terminal}-{year}-{seq:05d}",
				}
			)
	return gaps
