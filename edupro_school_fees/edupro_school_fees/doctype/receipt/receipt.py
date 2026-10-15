import hashlib
import secrets

import frappe
from frappe.model.document import Document
from frappe.rate_limiter import rate_limit
from frappe.utils import flt, getdate, now_datetime, nowdate

from edupro_school_fees.utils import BASE_CURRENCY, convert_amount, get_exchange_rate


CURRENT_HASH_VERSION = 3


def _compute_receipt_hash(doc, version=None):
	# Each field is normalized to a single canonical string form regardless of
	# whether `doc` is the just-inserted in-memory object (where amount can
	# still be a plain int/Decimal and posting_date a plain string) or a fresh
	# frappe.get_doc() load (where the DB round-trip casts them to float /
	# datetime.date) -- str() alone on the raw attribute gives two different
	# strings for the same real value depending on which of those `doc` is,
	# which would make every genuine (non-tampered) receipt fail verification.
	#
	# DEF-024: version 1 (every receipt submitted before this fix) covers only
	# the fields below the "v1" marker. version 2 adds payment_method,
	# narration, received_by, and the tender-line breakdown -- a tampered
	# printout changing those previously verified as "valid" under v1. The
	# version actually used is pinned per-receipt (doc.integrity_hash_version,
	# set once at submit and never changed after), so extending this payload
	# can never invalidate a hash an already-submitted receipt was given.
	version = version if version is not None else CURRENT_HASH_VERSION
	fields = [
		doc.name or "", doc.student or "", doc.invoice or "",
		f"{flt(doc.amount):.2f}", doc.currency or "",
		str(getdate(doc.posting_date)) if doc.posting_date else "",
		doc.payer_type or "", doc.payer or "",
	]
	if version >= 2:
		fields += [
			doc.payment_method or "", doc.narration or "", doc.received_by or "",
			"|".join(f"{row.payment_method}:{flt(row.amount):.2f}" for row in (doc.tender_lines or [])),
		]
	if version >= 3:
		fields += [
			"|".join(f"{row.fee_item}:{flt(row.amount):.2f}" for row in (doc.allocations or [])),
		]
	return hashlib.sha256("|".join(fields).encode("utf-8")).hexdigest()


class Receipt(Document):
	def before_insert(self):
		# Only when there's no allocations breakdown: when allocations ARE
		# given, _validate_allocations() (called from validate() below)
		# already caps each row at its own fee-item's remaining balance
		# (and the frontend's own allocation UI won't build an over-total
		# array in the first place), so this would otherwise double-handle
		# the same amount. Runs in before_insert(), not validate(), so the
		# whole cap-and-create-the-advance-receipt sequence completes
		# within this one request -- the frontend creates and submits a
		# Receipt as two separate API calls, and self.flags doesn't survive
		# across two separate Python objects the way it would across two
		# method calls on the same one.
		if self.invoice and not self.reversal_of and not self.allocations:
			# currency's fetch_from (payment_method.currency) hasn't
			# necessarily resolved yet this early in the lifecycle --
			# resolve it explicitly so the advance receipt created below
			# (if any) never gets an empty currency.
			if not self.currency and self.payment_method:
				self.currency = frappe.db.get_value("Payment Method", self.payment_method, "currency")
			self._cap_overpayment_into_advance()

	def validate(self):
		# Receipts are never deleted, only reversed with a justification.
		if self.reversal_of and not self.reversal_reason:
			frappe.throw("A reversal Receipt must state a reversal_reason.")

		# FR-CSH-04: a cashier whose most recent cash-up is still flagged for
		# variance cannot take new cash until a School Head resolves it.
		# Reversals are exempt -- they correct a past mistake, they don't take
		# new money, so they shouldn't be blocked by this.
		if self.is_new() and not self.reversal_of:
			from edupro_school_fees.edupro_school_fees.doctype.cash_up.cash_up import cashier_is_locked_out

			if cashier_is_locked_out(frappe.session.user):
				frappe.throw(
					"Your last cash-up has an unresolved variance. See the School Head to "
					"resolve it before recording new receipts.",
					frappe.PermissionError,
				)

		if self.tender_lines:
			tendered = flt(sum(row.amount or 0 for row in self.tender_lines), 2)
			if tendered != flt(self.amount, 2):
				frappe.throw(f"Split tender lines total {tendered}, which does not match Amount {self.amount}.")

		if self.allocations:
			self._validate_allocations()

		if not self.payer and self.student and self.payer_type in (None, "", "Parent Guardian"):
			guardian = frappe.db.get_value("Student", self.student, "guardian")
			if guardian:
				self.payer_type = "Parent Guardian"
				self.payer = guardian

		if not self.invoice:
			self.allocation_type = "Advance"
		else:
			due_date = frappe.db.get_value("Invoice", self.invoice, "due_date")
			if due_date and getdate(self.posting_date) > getdate(due_date):
				self.allocation_type = "Arrears"
			else:
				self.allocation_type = "Current"

		if self.is_new() and self.allocation_type == "Advance" and not self.reversal_of and not self.advance_remaining:
			self.advance_remaining = self.amount

	def _cap_overpayment_into_advance(self):
		"""GAP closed: a direct Receipt against one Invoice used to have no
		cap -- an amount exceeding the invoice's outstanding balance was
		silently absorbed, with the excess neither refunded nor tracked
		anywhere. Caps this receipt's own amount at the invoice's
		outstanding balance and, in the same request, creates AND submits a
		second, fully independent Advance receipt for the excess -- the
		same "excess becomes an Advance Receipt" pattern
		record_payment_with_allocation() already uses for the multi-invoice
		case, reached here from the single-receipt path too. Submitted
		immediately rather than left Draft, since Receipt.on_trash never
		allows deleting one regardless of docstatus -- an orphaned Draft
		would be permanently stuck.

		A split-tender receipt that would overpay is rejected outright
		rather than prorated across tender lines -- a rare combination, not
		worth risking a rounding mismatch in financial code for.

		CORRECTION, same day: this used to compare receipt_base_currency_
		total(self) (converted to ZiG) against outstanding. Invoice has no
		currency field of its own, though -- outstanding_amount is a raw
		sum of Invoice Line amounts in the school's native fee currency,
		overwhelmingly USD in real production data, not ZiG. Comparing a
		ZiG-converted total against it would flag ordinary USD payments as
		"overpaying" (170 look like 4590 against a 510 balance). Compares
		self.amount at face value instead, matching the same correction
		applied to create_journal_entry_for_receipt's invoice-balance
		update (see its own comment)."""
		outstanding = flt(frappe.db.get_value("Invoice", self.invoice, "outstanding_amount"), 2)
		total_amount = flt(self.amount, 2)
		if total_amount <= outstanding + 0.01:
			return

		if self.tender_lines:
			frappe.throw(
				f"This split-tender receipt totals {total_amount:.2f}, "
				f"which overpays {self.invoice} (outstanding {outstanding:.2f}). "
				"Reduce the tender amounts to match what's owed, then record the extra as a "
				"separate receipt with no Invoice selected (an Advance payment)."
			)

		if outstanding <= 0:
			frappe.throw(
				f"{self.invoice} is already fully paid. Record this as a separate receipt "
				"with no Invoice selected (an Advance payment) instead."
			)

		fraction = outstanding / total_amount
		capped_amount = flt(self.amount * fraction, 2)
		excess = flt(self.amount - capped_amount, 2)
		self.amount = capped_amount

		advance = frappe.get_doc({
			"doctype": "Receipt",
			"student": self.student,
			"payment_method": self.payment_method,
			"currency": self.currency,
			"amount": excess,
			"posting_date": self.posting_date,
			"payer_type": self.payer_type,
			"payer": self.payer,
			"external_reference": self.external_reference,
			"narration": f"Overpayment on {self.invoice}, recorded as advance credit",
		})
		advance.insert(ignore_permissions=True)
		advance.submit()
		self.flags.overpayment_advance_receipt = advance.name

	def _validate_allocations(self):
		"""Optional per-Fee-Item breakdown of this receipt's Amount -- purely a
		sub-ledger record for per-line balance reporting (see
		get_invoice_line_balances()), not a GL posting change: the Journal
		Entry is still one lump Dr Cash/Bank, Cr Debtors regardless."""
		allocated = flt(sum(row.amount or 0 for row in self.allocations), 2)
		if allocated != flt(self.amount, 2):
			frappe.throw(f"Fee allocation totals {allocated}, which does not match Amount {self.amount}.")
		if not self.invoice:
			frappe.throw("Fee allocation requires an Invoice to allocate against.")

		line_totals = {}
		line_currency = {}
		for row in frappe.get_all(
			"Invoice Line", filters={"parent": self.invoice, "parenttype": "Invoice"}, fields=["fee_item", "amount", "currency"]
		):
			line_totals[row.fee_item] = flt(line_totals.get(row.fee_item, 0) + row.amount, 2)
			line_currency[row.fee_item] = row.currency or BASE_CURRENCY

		# A reversal's allocations only ever give back room (see the negative
		# sign in _fee_item_paid_for_invoice), so it can never legitimately
		# exceed a line's total -- skip the cap check for one.
		if self.reversal_of:
			return

		already_paid = _fee_item_paid_for_invoice(self.invoice, exclude_receipt=None if self.is_new() else self.name)
		for row in self.allocations:
			line_total = line_totals.get(row.fee_item)
			if line_total is None:
				frappe.throw(f"{row.fee_item} is not a line on Invoice {self.invoice}.")
			remaining = flt(line_total - already_paid.get(row.fee_item, 0), 2)

			# row.amount is in this receipt's own currency (self.currency --
			# it must be, since the top-of-function check requires every
			# allocation row to sum to self.amount); remaining is in the
			# fee item's own currency (Invoice Line.currency). Convert before
			# comparing -- confirmed real gap: a ZiG receipt allocating
			# against a USD-denominated fee item compared raw numbers across
			# currencies, so it could never actually balance.
			row_currency = line_currency[row.fee_item]
			if row_currency == self.currency:
				row_amount_in_line_currency = flt(row.amount, 2)
			else:
				rate = get_exchange_rate(self.currency, row_currency, as_of_date=self.posting_date)
				row_amount_in_line_currency = flt(convert_amount(row.amount, self.currency, row_currency, rate), 2)

			if row_amount_in_line_currency > remaining + 0.01:
				frappe.throw(
					f"{row.fee_item} on {self.invoice} only has {remaining:.2f} {row_currency} outstanding -- "
					f"cannot allocate {row_amount_in_line_currency:.2f} {row_currency}."
				)

	def before_submit(self):
		# FR-REV-02/03: a reversal only takes effect once an authorized
		# supervisor (School Head) has approved it via approve_receipt_reversal
		# below -- checked here too, not just in that method, so submitting a
		# reversal directly through the ordinary API can't skip the gate.
		if self.reversal_of and not self.reversal_approved_by:
			frappe.throw(
				"This reversal has not been approved by a supervisor (School Head) yet. "
				"Ask them to approve it before it can be submitted."
			)

	def on_submit(self):
		if self.reversal_of:
			frappe.db.set_value("Receipt", self.reversal_of, "status", "Reversed")
		self.db_set("integrity_hash_version", CURRENT_HASH_VERSION, update_modified=False)
		self.db_set("integrity_hash", _compute_receipt_hash(self, CURRENT_HASH_VERSION), update_modified=False)

	def on_trash(self):
		frappe.throw(
			"Receipts cannot be deleted. Submit a reversing Receipt referencing this "
			"one via reversal_of, with a reversal_reason, instead."
		)


def _fee_item_paid_for_invoice(invoice_name, exclude_receipt=None):
	"""Net amount allocated to each Fee Item across every submitted Receipt
	against this Invoice -- a reversal's own allocations subtract (it gives
	back room, mirroring how it adds back to Invoice.outstanding_amount in
	utils.py's create_journal_entry_for_receipt), everything else adds."""
	receipts = frappe.get_all(
		"Receipt", filters={"invoice": invoice_name, "docstatus": 1}, fields=["name", "reversal_of"]
	)
	paid = {}
	for r in receipts:
		if exclude_receipt and r.name == exclude_receipt:
			continue
		sign = -1 if r.reversal_of else 1
		for row in frappe.get_all(
			"Receipt Allocation", filters={"parent": r.name, "parenttype": "Receipt"}, fields=["fee_item", "amount"]
		):
			paid[row.fee_item] = flt(paid.get(row.fee_item, 0) + sign * row.amount, 2)
	return paid


@frappe.whitelist()
def get_invoice_line_balances(invoice):
	"""Per-Fee-Item breakdown of an Invoice: each line's original amount, how
	much of it has been allocated via submitted Receipts so far, and what's
	still outstanding on that specific line -- what the Payment Desk's
	allocation UI shows so a Bursar can see e.g. "Tuition fully paid, Levy
	still owes 100" instead of only the Invoice's one lump outstanding_amount.

	Also returns each line's own currency (Invoice Line.currency is
	fetch_from=fee_item.currency, so it's the same for every row sharing a
	fee_item -- safe to key by fee_item alone). Confirmed real gap: without
	this, the Payment Desk had no way to know a line's amount was ZiG vs
	USD and auto-filled allocations by comparing raw numbers across
	currencies -- a ZiG receipt could never balance against a USD invoice
	line, since "Unallocated" was comparing ZiG cents to USD dollars."""
	lines = frappe.get_all(
		"Invoice Line", filters={"parent": invoice, "parenttype": "Invoice"}, fields=["fee_item", "amount", "currency"]
	)
	line_totals = {}
	line_currency = {}
	for row in lines:
		line_totals[row.fee_item] = flt(line_totals.get(row.fee_item, 0) + row.amount, 2)
		line_currency[row.fee_item] = row.currency or BASE_CURRENCY

	paid = _fee_item_paid_for_invoice(invoice)
	return [
		{
			"fee_item": fee_item,
			"total": total,
			"paid": flt(paid.get(fee_item, 0), 2),
			"outstanding": flt(total - paid.get(fee_item, 0), 2),
			"currency": line_currency[fee_item],
		}
		for fee_item, total in line_totals.items()
	]


@frappe.whitelist()
def request_receipt_reversal(receipt, reversal_reason):
	"""A Bursar drafts a reversal request against an existing submitted Receipt.
	It stays a Draft -- not yet posted, not yet affecting any balance -- until a
	School Head approves it via approve_receipt_reversal. Drafting the request
	and authorizing it are deliberately different people (FR-REV-02)."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may request a receipt reversal.", frappe.PermissionError)

	original = frappe.get_doc("Receipt", receipt)
	if original.reversal_of:
		frappe.throw("Cannot reverse a reversal Receipt.")
	if original.status == "Reversed":
		frappe.throw(f"{original.name} has already been reversed.")
	if frappe.db.exists("Receipt", {"reversal_of": receipt, "docstatus": ["!=", 2]}):
		frappe.throw(f"A reversal for {receipt} already exists (Draft or submitted).")
	if original.allocation_type == "Advance" and flt(original.advance_remaining, 2) != flt(original.amount, 2):
		frappe.throw(
			f"{original.name} is an advance payment that has already been partly or fully "
			"applied to an invoice, and cannot be reversed directly."
		)

	doc = frappe.get_doc({
		"doctype": "Receipt",
		"student": original.student,
		"invoice": original.invoice,
		"payment_method": original.payment_method,
		"currency": original.currency,
		"amount": original.amount,
		"posting_date": nowdate(),
		"external_reference": original.external_reference,
		"payer_type": original.payer_type,
		"payer": original.payer,
		"allocations": [{"fee_item": row.fee_item, "amount": row.amount} for row in original.allocations],
		"reversal_of": original.name,
		"reversal_reason": reversal_reason,
	})
	doc.insert()
	return doc.name


@frappe.whitelist()
def approve_receipt_reversal(reversal_receipt):
	"""Only a School Head -- the spec's "authorized supervisor" for reversals
	and write-offs (5.2.2) -- may approve one, and doing so submits it in the
	same call: nothing else is waiting on the Bursar once approval is given."""
	if "School Head" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only School Head may approve a receipt reversal.", frappe.PermissionError)

	doc = frappe.get_doc("Receipt", reversal_receipt)
	if not doc.reversal_of:
		frappe.throw(f"{doc.name} is not a reversal Receipt.")
	if doc.docstatus != 0:
		frappe.throw(f"{doc.name} has already been submitted.")

	doc.flags.ignore_permissions = True
	doc.reversal_approved_by = frappe.session.user
	doc.reversal_approved_on = now_datetime()
	doc.save()
	doc.submit()
	return doc.name


@frappe.whitelist()
def list_pending_reversals():
	"""Draft reversal Receipts awaiting a School Head's approval -- the queue
	that action is actually driven from."""
	if "School Head" not in frappe.get_roles(frappe.session.user) and "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Not permitted.", frappe.PermissionError)

	return frappe.get_all(
		"Receipt",
		filters={"reversal_of": ["is", "set"], "docstatus": 0},
		fields=["name", "student", "invoice", "amount", "currency", "reversal_of", "reversal_reason", "owner", "creation"],
		order_by="creation desc",
	)


@frappe.whitelist()
def record_payment_with_allocation(student, amount, payment_method, posting_date=None, external_reference=None, payer_type=None, payer=None):
	"""Allocates a single payment across a student's outstanding Invoices, oldest
	due_date first (so arrears are always covered before anything Current), each
	as its own submitted Receipt. Any amount left over once every outstanding
	Invoice is covered becomes a single Advance Receipt (no invoice attached) --
	automatically applied to the student's next new Invoice by
	Invoice._apply_available_advance() rather than sitting unaccounted for."""
	if "Bursar" not in frappe.get_roles(frappe.session.user):
		frappe.throw("Only a Bursar may record a payment.", frappe.PermissionError)

	amount = flt(amount, 2)
	if amount <= 0:
		frappe.throw("Amount must be greater than zero.")

	posting_date = posting_date or nowdate()
	common = {
		"student": student, "payment_method": payment_method, "posting_date": posting_date,
		"external_reference": external_reference, "payer_type": payer_type, "payer": payer,
	}

	outstanding_invoices = frappe.get_all(
		"Invoice",
		filters={"student": student, "docstatus": 1, "outstanding_amount": [">", 0], "status": ["!=", "Consolidated"]},
		fields=["name", "outstanding_amount"],
		order_by="due_date asc, posting_date asc",
	)

	remaining = amount
	created = []
	for inv in outstanding_invoices:
		if remaining <= 0:
			break
		take = min(flt(inv.outstanding_amount, 2), remaining)
		if take <= 0:
			continue
		receipt = frappe.get_doc({"doctype": "Receipt", "invoice": inv.name, "amount": take, **common})
		receipt.insert()
		receipt.submit()
		created.append(receipt.name)
		remaining = flt(remaining - take, 2)

	if remaining > 0:
		receipt = frappe.get_doc({"doctype": "Receipt", "amount": remaining, **common})
		receipt.insert()
		receipt.submit()
		created.append(receipt.name)

	return {"receipts": created}


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=20, seconds=60 * 60)
def verify_receipt(receipt, token=None):
	"""Public-facing tamper check for a printed receipt's QR code/hash -- the QR
	encodes both this document's name AND its integrity_hash (see report_service's
	QR generation), so a tampered PDF (an edited amount, date, or payer) is caught
	by recomputing the hash from the document's actual current field values and
	comparing.

	Deliberately guest-accessible (no login required) -- product decision:
	anyone who finds a printed or lost receipt can scan it and see the student
	name and amount without logging in, so a parent doesn't have to sign in on
	someone else's phone just to confirm a receipt is genuine. The tradeoff (a
	discarded receipt's details being visible to whoever picks it up) was made
	explicitly, not overlooked.

	`token` is mandatory and must match the receipt's own stored integrity_hash
	(a 64-char sha256 digest -- nothing this endpoint reveals could be used to
	derive it). Confirmed real gap: receipt IDs are sequential, so a bare
	verify_receipt(receipt) with no token let anyone walk RCPT-2026-00001
	upward and harvest every student's name/amount/date with no rate limit.
	Requiring the QR's own token turns this back into "you must have actually
	had the physical receipt," which was always the intended access model --
	plus a rate limit as defense in depth, matching portal_invitations.py's
	guest-endpoint pattern."""
	if not token or not frappe.db.exists("Receipt", receipt):
		return {"valid": False, "reason": "No such receipt."}
	doc = frappe.get_doc("Receipt", receipt)

	if doc.docstatus != 1:
		return {"valid": False, "reason": "Receipt is not submitted."}

	if not secrets.compare_digest(token, doc.integrity_hash or ""):
		return {"valid": False, "reason": "No such receipt."}

	# Recompute using this receipt's own pinned version (defaults to 1 for any
	# receipt submitted before integrity_hash_version existed) -- never the
	# current version, or every pre-DEF-024 receipt would wrongly fail.
	recomputed = _compute_receipt_hash(doc, doc.integrity_hash_version or 1)
	return {
		"valid": recomputed == doc.integrity_hash,
		"receipt": doc.name,
		"student": doc.student,
		"amount": doc.amount,
		"currency": doc.currency,
		"posting_date": str(doc.posting_date),
	}
