"""Bank/mobile-money statement import + automated matching (FR-PAY-xx).

A Bursar attaches a CSV export from the bank/EcoCash portal; parse_statement()
reads it into line items and immediately runs a conservative auto-match against
open Invoices. Nothing is ever posted to the ledger automatically -- a human
(the Bursar, via confirm_statement_line()) always confirms the specific
Invoice/Receipt a real transaction gets applied to, the same "no financial
action fully automated" posture this app already takes everywhere else (see
ADR 0018 on why a live EcoCash webhook was deliberately not built either).
"""

import csv
import io
import re

import frappe
from frappe.model.document import Document
from frappe.utils import flt

_INVOICE_REF_RE = re.compile(r"INV-\d{4}-\d+", re.IGNORECASE)


class BankStatementImport(Document):
	def on_trash(self):
		if self.status == "Completed" or any(row.match_status == "Posted" for row in self.lines):
			frappe.throw("A Bank Statement Import with posted lines cannot be deleted.")


def _parse_amount(raw):
	if raw in (None, ""):
		return 0.0
	return flt(str(raw).replace(",", "").replace("$", "").strip())


def _find_student_by_name_fragment(text):
	"""Exact-substring match on the student's full name only -- deliberately no
	fuzzy matching, since a loose match on a common name is exactly the kind of
	mistake that misapplies one family's payment to another's account."""
	text_lower = text.lower()
	candidates = frappe.get_all("Student", fields=["name", "first_name", "last_name"], filters={"status": "Active"})
	found = [
		c.name for c in candidates
		if c.first_name and c.last_name and f"{c.first_name} {c.last_name}".lower() in text_lower
	]
	return found[0] if len(found) == 1 else None


def _auto_match_line(row):
	"""A line is only ever auto-marked Matched when it names a real Invoice
	(directly, or via exactly one Active student whose amount lines up with
	exactly one of their open invoices) AND the amount matches that invoice's
	outstanding balance exactly. Anything short of that is left Unmatched/
	Manual Review for a human to resolve -- see set_manual_match()."""
	haystack = f"{row.reference or ''} {row.description or ''}"

	invoice_name = None
	direct = _INVOICE_REF_RE.search(haystack)
	if direct and frappe.db.exists("Invoice", direct.group(0).upper()):
		invoice_name = direct.group(0).upper()

	if not invoice_name:
		student_name = _find_student_by_name_fragment(haystack)
		if student_name:
			candidates = frappe.get_all(
				"Invoice",
				filters={
					"student": student_name, "docstatus": 1,
					"outstanding_amount": flt(row.amount, 2), "status": ["!=", "Consolidated"],
				},
				pluck="name",
			)
			if len(candidates) == 1:
				invoice_name = candidates[0]

	if not invoice_name:
		row.match_status = "Manual Review"
		return

	invoice = frappe.db.get_value("Invoice", invoice_name, ["student", "outstanding_amount"], as_dict=True)
	if flt(invoice.outstanding_amount, 2) != flt(row.amount, 2):
		row.match_status = "Manual Review"
		return

	row.matched_invoice = invoice_name
	row.matched_student = invoice.student
	row.match_status = "Matched"


@frappe.whitelist()
def parse_statement(bank_statement_import):
	"""Reads the attached CSV (columns: date, description, reference, amount --
	case-insensitive) into Bank Statement Line rows and runs auto-matching
	immediately. Rows with a zero/negative amount (bank charges, reversals,
	failed transactions on the bank's own side) are skipped -- this import only
	ever represents money coming in."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may import a bank statement.", frappe.PermissionError)

	doc = frappe.get_doc("Bank Statement Import", bank_statement_import)
	if doc.lines:
		frappe.throw("This import has already been parsed.")
	if not doc.statement_file:
		frappe.throw("Attach a statement file before parsing.")

	file_doc = frappe.get_doc("File", {"file_url": doc.statement_file})
	content = file_doc.get_content()
	if isinstance(content, bytes):
		content = content.decode("utf-8")

	reader = csv.DictReader(io.StringIO(content))
	fieldmap = {(name or "").strip().lower(): name for name in (reader.fieldnames or [])}

	def _get(row, key):
		col = fieldmap.get(key)
		return row.get(col) if col else None

	added = 0
	for row in reader:
		amount = _parse_amount(_get(row, "amount"))
		date = _get(row, "date")
		if not date or amount <= 0:
			continue
		doc.append("lines", {
			"transaction_date": date,
			"description": _get(row, "description") or "",
			"reference": _get(row, "reference") or "",
			"amount": amount,
		})
		added += 1

	doc.status = "Parsed"
	doc.save()

	for row in doc.lines:
		if row.match_status == "Unmatched":
			_auto_match_line(row)
	doc.save()

	return {"lines_added": added}


@frappe.whitelist()
def set_manual_match(bank_statement_import, row_name, invoice):
	"""A Bursar's manual resolution for a line auto-matching couldn't confidently
	place -- names the specific Invoice (and, by extension, Student) the money
	is for, so confirm_statement_line() has something concrete to post against."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may set a manual match.", frappe.PermissionError)

	doc = frappe.get_doc("Bank Statement Import", bank_statement_import)
	row = next((r for r in doc.lines if r.name == row_name), None)
	if not row:
		frappe.throw("Statement line not found.")
	if row.match_status == "Posted":
		frappe.throw("This line has already been posted.")

	student = frappe.db.get_value("Invoice", invoice, "student")
	if not student:
		frappe.throw(f"{invoice} is not a valid Invoice.")

	row.matched_invoice = invoice
	row.matched_student = student
	row.match_status = "Matched"
	doc.save()
	return row.name


@frappe.whitelist()
def confirm_statement_line(bank_statement_import, row_name):
	"""Posts a real, submitted Receipt for a Matched line -- the one point in
	this whole flow where money actually moves in the ledger, always requiring
	a Bursar to have explicitly confirmed (never automatic)."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may post a matched statement line.", frappe.PermissionError)

	doc = frappe.get_doc("Bank Statement Import", bank_statement_import)
	row = next((r for r in doc.lines if r.name == row_name), None)
	if not row:
		frappe.throw("Statement line not found.")
	if row.match_status == "Posted":
		frappe.throw("This line has already been posted.")
	if not row.matched_invoice or not row.matched_student:
		frappe.throw("This line has no matched Invoice/Student -- use set_manual_match() first.")

	receipt = frappe.get_doc({
		"doctype": "Receipt",
		"student": row.matched_student,
		"invoice": row.matched_invoice,
		"payment_method": doc.bank_account,
		"amount": row.amount,
		"posting_date": row.transaction_date,
		"external_reference": row.reference,
	})
	receipt.insert()
	receipt.submit()

	row.match_status = "Posted"
	row.receipt = receipt.name
	doc.save()

	if all(r.match_status == "Posted" for r in doc.lines):
		doc.status = "Completed"
		doc.save()

	return receipt.name
