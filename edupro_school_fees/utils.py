"""Cross-DocType hooks: the Invoice/Receipt -> Journal Entry -> Audit Log chain.

Kept in one module (rather than duplicated per-controller) because every write here
must produce a matching Audit Log entry, and a GL posting must exist before any
statement can be generated.
"""

import frappe
from frappe.utils import cint, flt, getdate, now_datetime

BASE_CURRENCY = "ZiG"


def get_exchange_rate(from_currency, to_currency, as_of_date=None):
	"""The latest active rate for (from_currency -> to_currency) on or before
	as_of_date, falling back to the inverse of an active (to_currency -> from_currency)
	rate if the direct pair was never recorded. Throws rather than guessing 1:1 --
	silently mis-converting real money is worse than a loud failure."""
	if from_currency == to_currency:
		return 1.0

	as_of_date = as_of_date or frappe.utils.nowdate()

	direct = frappe.db.get_value(
		"Exchange Rate",
		{
			"from_currency": from_currency,
			"to_currency": to_currency,
			"effective_date": ["<=", as_of_date],
			"is_active": 1,
		},
		"exchange_rate",
		order_by="effective_date desc",
	)
	if direct:
		return direct

	inverse = frappe.db.get_value(
		"Exchange Rate",
		{
			"from_currency": to_currency,
			"to_currency": from_currency,
			"effective_date": ["<=", as_of_date],
			"is_active": 1,
		},
		"exchange_rate",
		order_by="effective_date desc",
	)
	if inverse:
		return 1 / inverse

	frappe.throw(
		f"No active Exchange Rate found for {from_currency} -> {to_currency} "
		f"on or before {as_of_date}."
	)


def convert_amount(amount, from_currency, to_currency, rate=None):
	"""Convert amount at a given rate (e.g. one already snapshotted on a Journal Entry
	Account row) or, if none is given, the current get_exchange_rate()."""
	if from_currency == to_currency:
		return amount
	rate = rate if rate is not None else get_exchange_rate(from_currency, to_currency)
	return frappe.utils.flt(amount * rate, 2)


def _account_exchange_rate(account, posting_date):
	"""The rate to convert `account`'s own currency into BASE_CURRENCY, snapshotted at
	posting_date -- 1 for a BASE_CURRENCY account, no DB lookup needed."""
	account_currency = frappe.db.get_value("Account", account, "currency")
	return get_exchange_rate(account_currency, BASE_CURRENCY, as_of_date=posting_date)


def _to_base_currency(amount, currency, as_of_date=None):
	"""Converts a document's own native-currency amount into BASE_CURRENCY
	(ZiG) before it becomes a Journal Entry debit/credit. Every line in one
	Journal Entry must already be in the same currency for
	JournalEntry.validate()'s debit==credit check to mean anything --
	Journal Entry Account's own `exchange_rate` field is only ever a
	snapshot for reference (see _account_exchange_rate/_create_journal_entry),
	never applied to the stored amount.

	This is the fix for a critical, independently-confirmed production bug:
	create_journal_entry_for_receipt and create_journal_entry_for_invoice
	were posting a Receipt's/Invoice Line's raw native amount unconverted --
	a $40.50 USD receipt credited Debtors (a ZiG-tracked control account)
	with the number 40.50, silently treating it as 40.50 ZiG. Confirmed
	against real production data: 16 of 17 submitted Receipts are USD, so
	this affected the overwhelming majority of real transactions.

	Deliberately not applied to Credit Note or Petty Cash Replenishment in
	this pass -- neither doctype carries its own currency field (Credit
	Note's write-off amount and a replenishment's per-account lines both
	read as already-ZiG-only by design), and guessing a conversion for a
	field that was never meant to hold anything but ZiG risks introducing
	a *new* error rather than fixing a confirmed one. Needs its own
	verification, not assumed safe by analogy to Receipt/Invoice."""
	if currency == BASE_CURRENCY:
		return flt(amount, 2)
	rate = get_exchange_rate(currency, BASE_CURRENCY, as_of_date=as_of_date)
	return flt(convert_amount(amount, currency, BASE_CURRENCY, rate), 2)


def _create_audit_log(doc, action, justification=""):
	frappe.get_doc({
		"doctype": "Audit Log",
		"user": frappe.session.user,
		"role": ", ".join(frappe.get_roles(frappe.session.user)),
		"action": action,
		"reference_doctype": doc.doctype,
		"reference_name": doc.name,
		"justification": justification,
		"timestamp": now_datetime(),
	}).insert(ignore_permissions=True)


def _reference_fund(reference_doctype, reference_name):
	"""Best-effort single fund for a Journal Entry, derived from its reference
	document. Cashbook Payment always has exactly one fund (copied from its
	Payment Voucher at validate() time). Petty Cash Replenishment can span
	multiple funds in one JE (one line per distinct expense account being
	replenished) so is deliberately left unset rather than guessed -- SDC's
	fund scoping treats an unset fund as invisible, the safe default when
	attribution is genuinely ambiguous. Invoice/Receipt/Asset/Applicant
	(fee-side, asset, and application-fee entries) default to Fund A, the
	dominant case for tuition/government income this app doesn't otherwise
	fund-tag per transaction."""
	if reference_doctype == "Cashbook Payment" and reference_name:
		return frappe.db.get_value("Cashbook Payment", reference_name, "fund")
	if reference_doctype in ("Invoice", "Receipt", "Asset", "Credit Note", "Applicant"):
		return "Fund A - General/Government"
	return None


def _latest_closed_period_date():
	return frappe.db.get_value("Period Lock", {"status": "Closed"}, "closing_date", order_by="closing_date desc")


def _create_journal_entry(posting_date, reference_doctype, reference_name, lines, remarks, fund_override=Ellipsis, extra_fields=None):
	locked_through = _latest_closed_period_date()
	if locked_through and getdate(posting_date) <= getdate(locked_through):
		frappe.throw(
			f"Posting date {posting_date} falls within a closed period (locked through {locked_through}). "
			"A new Journal Entry cannot be posted there."
		)

	for line in lines:
		line.setdefault("exchange_rate", _account_exchange_rate(line["account"], posting_date))

	# fund_override lets a caller that already knows better (e.g. a Petty Cash
	# Replenishment that has just computed the single fund all of its pending
	# vouchers' Budget Lines share) skip the generic _reference_fund() guess.
	# Ellipsis (not None) is the "not given" sentinel, since None/unset fund is
	# itself a meaningful, deliberate value for a genuinely mixed-fund entry.
	fund = _reference_fund(reference_doctype, reference_name) if fund_override is Ellipsis else fund_override

	je = frappe.get_doc({
		"doctype": "Journal Entry",
		"posting_date": posting_date,
		"reference_doctype": reference_doctype,
		"reference_name": reference_name,
		"fund": fund,
		"remarks": remarks,
		"entries": lines,
		**(extra_fields or {}),
	})
	je.insert(ignore_permissions=True)
	je.submit()
	return je


def create_journal_entry_for_invoice(doc, method=None):
	"""Dr Debtors / Cr Fees Income for the genuinely new charges on this invoice
	only -- excluding both kinds of non-charge lines an invoice can carry:

	- A "Balance Brought Forward" line (Invoice._carry_forward_prior_balances())
	  represents debt already recognized as income when the OLD invoice it came
	  from was itself submitted; posting it again here would double-count that
	  income (and double-debit Debtors) on top of the original, still-standing
	  entry.
	- An "Advance Payment Applied" line (Invoice._apply_available_advance()) is
	  money the student already paid before this invoice existed, parked in
	  Unearned Revenue at the time. It still gets recognized as genuine new
	  Income here (accrual happens at billing, not payment) -- but its Debtors
	  side is released from Unearned Revenue instead of newly invoiced, via a
	  second pair of JE lines below.

	Each line is converted from its own Fee Item's currency into
	BASE_CURRENCY (ZiG) before being summed (see _to_base_currency) -- Invoice
	Line/Fee Item carry a per-line `currency` field (ZiG/USD), and a
	USD-denominated fee item combined with ZiG-denominated lines in one
	Invoice used to post its raw, unconverted dollar figure straight to a
	ZiG-tracked Debtors/Income account (the invoice-side half of a critical,
	independently-confirmed production bug -- see create_journal_entry_for_receipt
	for the other half and the numbers that confirmed it).
	"""
	debtors_account = frappe.db.get_value("Account", {"account_type": "Asset", "account_name": "Debtors"})
	default_income_account = frappe.db.get_value("Account", {"account_type": "Income", "account_name": "Fees Income"})
	if not debtors_account or not default_income_account:
		frappe.throw("Debtors and Fees Income accounts must exist before invoices can be submitted.")

	regular_rows = [row for row in doc.items if not row.is_brought_forward and not row.is_advance_applied]
	regular_converted = [
		(row, _to_base_currency(row.amount or 0, row.currency or BASE_CURRENCY, doc.posting_date))
		for row in regular_rows
	]
	regular_charges = flt(sum(amount for _, amount in regular_converted), 2)
	advance_converted = [
		_to_base_currency(abs(row.amount or 0), row.currency or BASE_CURRENCY, doc.posting_date)
		for row in doc.items
		if row.is_advance_applied
	]
	advance_applied = flt(sum(advance_converted), 2)

	if regular_charges == 0 and advance_applied <= 0:
		_create_audit_log(doc, action="Invoice Submitted")
		return

	lines = []
	if regular_charges != 0:
		# Each line posts to its own Fee Item's configured income account
		# (Invoice Line.account, fetched from Fee Item.account) rather than one
		# hardcoded "Fees Income" account -- a school mapping Tuition and Levy
		# to separate income accounts needs that split to actually reach the GL.
		#
		# regular_charges is usually positive (a real new charge), but an
		# Opening Balance invoice migrating a credit/overpayment from a prior
		# accounting system is legitimately negative -- the mirror entry
		# (Cr Debtors / Dr the fee item's own account) still has to post, or
		# that credit exists on the Invoice but is invisible in the GL.
		income_totals = {}
		for row, amount in regular_converted:
			account = row.account or default_income_account
			income_totals[account] = flt(income_totals.get(account, 0) + amount, 2)

		if regular_charges > 0:
			lines.append({"account": debtors_account, "debit": regular_charges, "credit": 0})
		else:
			lines.append({"account": debtors_account, "debit": 0, "credit": -regular_charges})
		for account, amount in income_totals.items():
			if amount > 0:
				lines.append({"account": account, "debit": 0, "credit": amount})
			elif amount < 0:
				lines.append({"account": account, "debit": -amount, "credit": 0})
	if advance_applied > 0:
		unearned_account = frappe.db.get_value("Account", {"account_type": "Liability", "account_name": "Unearned Revenue"})
		if not unearned_account:
			frappe.throw("An 'Unearned Revenue' Liability account must exist before an advance payment can be applied to an invoice.")
		lines += [
			{"account": unearned_account, "debit": advance_applied, "credit": 0},
			{"account": debtors_account, "debit": 0, "credit": advance_applied},
		]

	_create_journal_entry(
		posting_date=doc.posting_date,
		reference_doctype="Invoice",
		reference_name=doc.name,
		lines=lines,
		remarks=f"Invoice {doc.name} for {doc.student}",
	)
	_create_audit_log(doc, action="Invoice Submitted")


def receipt_base_currency_total(doc):
	"""The converted BASE_CURRENCY (ZiG) total a Receipt actually represents
	-- shared by create_journal_entry_for_receipt (the GL posting) and
	Receipt._cap_overpayment_into_advance() (the amount-vs-outstanding
	cap), so the two can never drift apart the way Invoice.outstanding_amount
	and the GL once did for a cross-currency receipt (see
	create_journal_entry_for_receipt's own history). Mirrors that function's
	cash_lines computation: sum of each tender line converted at its own
	Payment Method's currency, or the receipt's own amount/currency when
	there are no tender lines."""
	tender_lines = doc.get("tender_lines") or []
	if tender_lines:
		total = 0
		for tender in tender_lines:
			tender_currency = frappe.db.get_value("Payment Method", tender.payment_method, "currency")
			total += _to_base_currency(tender.amount, tender_currency, doc.posting_date)
		return flt(total, 2)
	return flt(_to_base_currency(doc.amount, doc.currency, doc.posting_date), 2)


def refresh_debtor_cases_for_student(doc, method=None):
	"""Debtor Case.outstanding_amount/ageing_bucket only recompute when that case
	itself is saved (refresh_ageing(), called from validate()) -- nothing
	previously called that when a Receipt changed the balance it's derived from,
	so a case could show a stale figure until the next daily scheduler run or a
	user happened to open it. Runs on every Receipt submit, forward or reversal
	(reversal is just another Receipt submission), for every Debtor Case tied to
	that student, regardless of workflow_state.

	Also closes a related gap: a Resolved case whose balance comes back (a
	reversed payment) can't just be silently re-saved -- validate()'s own
	resolve-guard throws if workflow_state is still "Resolved" with a nonzero
	balance -- and the daily scheduler (run_debtor_ageing_escalation) skips every
	Resolved case, so nothing else would ever revisit it. Reopen it here instead,
	the moment its balance reappears."""
	if not doc.student:
		return
	for name in frappe.get_all("Debtor Case", filters={"student": doc.student}, pluck="name"):
		case = frappe.get_doc("Debtor Case", name)
		was_resolved = case.workflow_state == "Resolved"
		case.refresh_ageing()
		if was_resolved and case.outstanding_amount > 0:
			case.workflow_state = "Open"
		case.save(ignore_permissions=True)


def create_journal_entry_for_receipt(doc, method=None):
	"""Dr Bank-Cash / Cr Debtors for the amount received, and reduce the invoice's
	outstanding balance. A reversal Receipt (doc.reversal_of set) posts the exact
	opposite entry and restores the balance it once reduced -- so a reversal
	always nets its original to zero by construction, rather than depending on
	whoever books it remembering to key in a negative amount.

	An Advance receipt (no invoice -- allocation_type "Advance") credits Unearned
	Revenue instead of Debtors: this money isn't reducing any existing receivable
	yet, it's a prepayment against fees not yet billed. It only becomes Debtors/
	Income once a later Invoice applies it (Invoice._apply_available_advance()).

	A split-tender receipt (tender_lines populated) debits/credits each tender
	line's own Payment Method account individually instead of the single
	payment_method field, so the cash side of the JE reflects exactly how the
	money was actually received.

	Every cash leg is converted from its own Payment Method's currency into
	BASE_CURRENCY (ZiG) before posting (see _to_base_currency) -- the
	Debtors/Unearned Revenue counter leg is the *sum of those converted
	amounts*, not doc.amount's raw native figure, so a split-tender receipt
	mixing a USD and a ZiG tender still balances correctly in one currency."""
	if doc.allocation_type == "Advance":
		counter_account = frappe.db.get_value("Account", {"account_type": "Liability", "account_name": "Unearned Revenue"})
		if not counter_account:
			frappe.throw("An 'Unearned Revenue' Liability account must exist before an advance payment can be receipted.")
	else:
		counter_account = frappe.db.get_value("Account", {"account_type": "Asset", "account_name": "Debtors"})
		if not counter_account:
			frappe.throw("The Debtors account must exist before receipting.")

	tender_lines = doc.get("tender_lines") or []
	if tender_lines:
		cash_lines = []
		for tender in tender_lines:
			account = frappe.db.get_value("Payment Method", tender.payment_method, "account")
			tender_currency = frappe.db.get_value("Payment Method", tender.payment_method, "currency")
			if not account:
				frappe.throw(f"Payment Method {tender.payment_method}'s account must exist before receipting.")
			cash_lines.append((account, _to_base_currency(tender.amount, tender_currency, doc.posting_date)))
	else:
		cash_account = frappe.db.get_value("Payment Method", doc.payment_method, "account")
		if not cash_account:
			frappe.throw("Payment Method's account must exist before receipting.")
		cash_lines = [(cash_account, _to_base_currency(doc.amount, doc.currency, doc.posting_date))]

	counter_amount = receipt_base_currency_total(doc)

	is_reversal = bool(doc.reversal_of)
	if is_reversal:
		lines = [{"account": counter_account, "debit": counter_amount, "credit": 0}]
		lines += [{"account": account, "debit": 0, "credit": amount} for account, amount in cash_lines]
	else:
		lines = [{"account": account, "debit": amount, "credit": 0} for account, amount in cash_lines]
		lines.append({"account": counter_account, "debit": 0, "credit": counter_amount})

	_create_journal_entry(
		posting_date=doc.posting_date,
		reference_doctype="Receipt",
		reference_name=doc.name,
		lines=lines,
		remarks=(
			f"Reversal of {doc.reversal_of} via Receipt {doc.name} for {doc.student}"
			if is_reversal
			else f"Receipt {doc.name} for {doc.student}"
		),
	)

	if doc.invoice:
		invoice = frappe.get_doc("Invoice", doc.invoice)
		current = invoice.outstanding_amount if invoice.outstanding_amount is not None else invoice.total_amount
		# Uses doc.amount (the receipt's own native-currency figure), NOT
		# counter_amount (the converted-to-ZiG figure posted to Debtors
		# above). CORRECTION, same day: an earlier version of this fix used
		# counter_amount here too, reasoning that Invoice.outstanding_amount
		# should track the same ZiG figure as the GL. That was wrong for
		# real production data -- Invoice has no currency field of its own;
		# total_amount/outstanding_amount are a raw sum of Invoice Line
		# amounts in the school's native fee currency, which in practice is
		# overwhelmingly USD (900+ of ~1200 Invoice Line rows), not ZiG.
		# Converting a USD receipt into ZiG before reducing a USD-
		# denominated invoice balance corrupted it (confirmed live: a real
		# $170 receipt against a real $510 balance wrongly zeroed it out,
		# since 170 * 27 = 4590 far exceeds 510). doc.amount is correct
		# whenever the receipt's currency matches the invoice's own
		# (the overwhelmingly common real case); a receipt in a genuinely
		# different currency than the invoice's fee items remains an open
		# gap, not solved by this line either way.
		if is_reversal:
			invoice.outstanding_amount = min(invoice.total_amount, current + doc.amount)
		else:
			invoice.outstanding_amount = max(0, current - doc.amount)

		if invoice.outstanding_amount == 0:
			invoice.status = "Paid"
		elif invoice.outstanding_amount == invoice.total_amount:
			invoice.status = "Unpaid"
		else:
			invoice.status = "Partly Paid"
		invoice.save(ignore_permissions=True)

	_create_audit_log(
		doc,
		action="Receipt Reversal Submitted" if is_reversal else "Receipt Submitted",
		justification=doc.reversal_reason or "",
	)


def create_journal_entry_for_credit_note(doc):
	"""Dr Bad Debts Written Off / Cr Debtors -- a write-off is not a payment (no
	cash moves), so it can never reuse Receipt's Dr Cash/Cr Debtors shape. Posted
	once, from Credit Note.on_update() the moment workflow_state first reaches
	Approved (School Head), mirroring how Receipt reversal only takes effect
	once its own authorized supervisor has signed off."""
	debtors_account = frappe.db.get_value("Account", {"account_type": "Asset", "account_name": "Debtors"})
	write_off_account = frappe.db.get_value("Account", {"account_type": "Expense", "account_name": "Bad Debts Written Off"})
	if not debtors_account or not write_off_account:
		frappe.throw("Debtors and 'Bad Debts Written Off' accounts must exist before a Credit Note can be approved.")

	_create_journal_entry(
		posting_date=doc.posting_date,
		reference_doctype="Credit Note",
		reference_name=doc.name,
		lines=[
			{"account": write_off_account, "debit": doc.amount, "credit": 0},
			{"account": debtors_account, "debit": 0, "credit": doc.amount},
		],
		remarks=f"Credit Note {doc.name} against {doc.invoice} for {doc.student}: {doc.reason}",
	)

	invoice = frappe.get_doc("Invoice", doc.invoice)
	current = invoice.outstanding_amount if invoice.outstanding_amount is not None else invoice.total_amount
	invoice.outstanding_amount = max(0, flt(current - doc.amount, 2))
	if invoice.outstanding_amount == 0:
		invoice.status = "Paid"
	elif invoice.outstanding_amount == invoice.total_amount:
		invoice.status = "Unpaid"
	else:
		invoice.status = "Partly Paid"
	invoice.save(ignore_permissions=True)

	_create_audit_log(doc, action="Credit Note Approved", justification=doc.reason)


def create_journal_entry_for_cashbook_payment(doc, expense_account, payment_account):
	"""Dr Expense (the Budget Line's own account) / Cr Cash-Bank (the Payment Method's
	account) -- the actual money-movement event a Payment Voucher's approval only
	authorized. Everything before this point (Requisition -> PO -> Payment Voucher)
	is authorization; this is the first Phase 6b doctype that actually disburses.

	doc.amount is converted from doc.currency into BASE_CURRENCY (ZiG) before
	posting -- same fix, same reason, as create_journal_entry_for_receipt."""
	amount = _to_base_currency(doc.amount, doc.currency, doc.posting_date)
	_create_journal_entry(
		posting_date=doc.posting_date,
		reference_doctype="Cashbook Payment",
		reference_name=doc.name,
		lines=[
			{"account": expense_account, "debit": amount, "credit": 0},
			{"account": payment_account, "debit": 0, "credit": amount},
		],
		remarks=f"Cashbook Payment {doc.name} for {doc.payment_voucher}",
	)
	_create_audit_log(doc, action="Cashbook Payment Submitted")


def create_journal_entry_for_petty_cash_replenishment(doc, lines, fund=None):
	"""One JE line per distinct expense account being replenished (Dr), balanced by a
	single credit to the Payment Method's bank account -- keeps each Budget Line's own
	vote correctly charged even though one replenishment can cover many vouchers across
	different votes.

	DEF-020: `fund` is set by the caller (petty_cash_replenishment.py's on_submit())
	when every pending voucher it's reimbursing shares one Budget Line fund --
	left None (SDC-invisible, same as before) only for a genuinely mixed-fund
	replenishment, where no single fund label would be honest."""
	_create_journal_entry(
		posting_date=doc.posting_date,
		reference_doctype="Petty Cash Replenishment",
		reference_name=doc.name,
		lines=lines,
		remarks=f"Petty Cash Replenishment {doc.name} for {doc.petty_cash_float}",
		fund_override=fund,
	)
	_create_audit_log(doc, action="Petty Cash Replenishment Submitted")


def run_asset_depreciation():
	"""Monthly scheduler job (see hooks.py): posts one straight-line depreciation
	Journal Entry per in-use Asset, capped so accumulated_depreciation never exceeds
	historical_cost. The only place depreciation is ever written -- never computed
	ad hoc by a report, so the GL and the Asset Register can't drift apart.

	period_depreciation stays in the Asset's own currency for the Asset
	Register (historical_cost/accumulated_depreciation both track native,
	same convention as Invoice.outstanding_amount) -- only the JE posting
	itself uses the BASE_CURRENCY-converted figure, same fix as
	create_journal_entry_for_receipt."""
	for asset_name in frappe.get_all("Asset", filters={"disposal_status": "In Use"}, pluck="name"):
		asset = frappe.get_doc("Asset", asset_name)
		annual_depreciation = flt(asset.historical_cost * (asset.depreciation_rate or 0) / 100, 2)
		remaining = flt(asset.historical_cost - (asset.accumulated_depreciation or 0), 2)
		period_depreciation = min(flt(annual_depreciation / 12, 2), remaining)
		if period_depreciation <= 0:
			continue

		posted_amount = _to_base_currency(period_depreciation, asset.currency, frappe.utils.nowdate())
		_create_journal_entry(
			posting_date=frappe.utils.nowdate(),
			reference_doctype="Asset",
			reference_name=asset.name,
			lines=[
				{"account": asset.depreciation_expense_account, "debit": posted_amount, "credit": 0},
				{"account": asset.accumulated_depreciation_account, "debit": 0, "credit": posted_amount},
			],
			remarks=f"Monthly straight-line depreciation for {asset.name}",
		)
		asset.accumulated_depreciation = flt((asset.accumulated_depreciation or 0) + period_depreciation, 2)
		asset.save(ignore_permissions=True)
		_create_audit_log(asset, action=f"Depreciation posted: {period_depreciation}")


def log_fee_structure_transition(doc, method=None):
	"""Every workflow-state change on Fee Structure is an audit event."""
	if doc.has_value_changed("workflow_state"):
		_create_audit_log(
			doc,
			action=f"Fee Structure workflow_state -> {doc.workflow_state}",
		)


def log_debtor_case_transition(doc, method=None):
	"""Every case-status change on Debtor Case is an audit event."""
	if doc.has_value_changed("workflow_state"):
		_create_audit_log(
			doc,
			action=f"Debtor Case workflow_state -> {doc.workflow_state}",
		)


def log_payment_voucher_transition(doc, method=None):
	"""Every approval-chain step (Co-Approve/Approve/Reject) on a Payment
	Voucher is an audit event -- previously invisible to Audit Log entirely,
	unlike every other approval workflow in this app."""
	if doc.has_value_changed("workflow_state"):
		_create_audit_log(doc, action=f"Payment Voucher workflow_state -> {doc.workflow_state}")


def log_school_setup_change(doc, method=None):
	"""Any save of the School Setup singleton is a configuration-change audit
	event -- banking configuration, thresholds, and procurement bands all
	live here, and none of it was visible to Audit Log before."""
	_create_audit_log(doc, action="School Setup updated")


def log_purchase_order_issued(doc, method=None):
	"""Procurement's own validation gate (PRAZ quote count, Approved vendor,
	budget balance) already runs in Purchase Order.validate() -- this just
	makes the fact that it *passed* and a real PO was issued a visible audit
	event, alongside every other procurement approval step."""
	_create_audit_log(doc, action=f"Purchase Order issued against {doc.requisition} for {doc.vendor_name}")


def log_user_role_change(doc, method=None):
	"""DEF-031: role/permission grants and revocations are the one audit
	event category the spec names most directly (AC-03: "role changes
	require... audit logging") that had zero coverage anywhere. Table fields
	(User.roles) don't work with has_value_changed() -- Frappe's BaseDocument
	has no value equality for child-Document lists, so it always reports
	changed even when the contents match (same caution already documented on
	Fee Structure's own item-diff check) -- compare role name sets instead."""
	if doc.is_new():
		return
	doc_before_save = doc.get_doc_before_save()
	if not doc_before_save:
		return
	before_roles = {r.role for r in doc_before_save.roles}
	after_roles = {r.role for r in doc.roles}
	if before_roles == after_roles:
		return

	added = sorted(after_roles - before_roles)
	removed = sorted(before_roles - after_roles)
	parts = []
	if added:
		parts.append(f"added {', '.join(added)}")
	if removed:
		parts.append(f"removed {', '.join(removed)}")
	_create_audit_log(doc, action=f"Roles changed for {doc.name}: {'; '.join(parts)}")


def log_bank_reconciliation_transition(doc, method=None):
	"""Every sign-off/discrepancy-flag state change on Bank Reconciliation is
	an audit event -- previously invisible to Audit Log entirely, unlike
	every other approval workflow in this app. Part of DEF-032."""
	if doc.has_value_changed("workflow_state"):
		_create_audit_log(doc, action=f"Bank Reconciliation workflow_state -> {doc.workflow_state}")


@frappe.whitelist()
def get_my_roles():
	"""The frontend's post-login role fetch used to call Frappe core's
	frappe.core.doctype.user.user.get_roles, which a framework version bump
	removed outright (broke login site-wide -- the frontend silently treats
	any failed post-login fetch as "not logged in" and bounces back to
	/sign-in). frappe.get_roles() itself is a stable, long-standing internal
	function everything else in this app already relies on (see
	log_user_login below) -- wrapping it here means future core API
	reshuffling can't break login again without also breaking half this app."""
	return frappe.get_roles(frappe.session.user)


def log_user_login(login_manager):
	"""Every successful login is an audit event (access-log requirement) --
	hooked via hooks.py's on_session_creation, not a doc_event, since it
	isn't tied to any one DocType."""
	frappe.get_doc({
		"doctype": "Audit Log",
		"user": login_manager.user,
		"role": ", ".join(frappe.get_roles(login_manager.user)),
		"action": "User login",
		"timestamp": now_datetime(),
	}).insert(ignore_permissions=True)


def compute_ageing_bucket(days_overdue):
	"""Classify how overdue a balance is. days_overdue <= 0 means not yet due (or
	fully current)."""
	if days_overdue <= 0:
		return "Current"
	if days_overdue <= 30:
		return "1-30 Days"
	if days_overdue <= 60:
		return "31-60 Days"
	if days_overdue <= 90:
		return "61-90 Days"
	return "90+ Days"


_REMINDER_STAGE_ORDER = ["None", "First", "Second", "Escalation"]


def _reminder_stage(days_overdue, first_days, second_days, escalation_days):
	if days_overdue >= escalation_days:
		return "Escalation"
	if days_overdue >= second_days:
		return "Second"
	if days_overdue >= first_days:
		return "First"
	return "None"


def run_debtor_ageing_escalation():
	"""Daily scheduler job (see hooks.py): the only place Debtor Case ageing state
	gets written outside of a user's own save. Refreshes every open case's
	outstanding_amount/ageing_bucket/days_overdue, sends a graduated reminder the
	first time a case crosses the school's configured first/second-reminder day
	thresholds (get_debtor_reminder_settings()), and auto-escalates a case that has
	drifted past the configured escalation threshold (historically a hardcoded 90
	days) and isn't already Escalated/Legal/Resolved. last_reminder_stage on the
	case makes each stage fire exactly once per overdue cycle."""
	first_days, second_days, escalation_days, first_template, second_template = get_debtor_reminder_settings()

	open_cases = frappe.get_all(
		"Debtor Case",
		filters={"workflow_state": ["not in", ["Resolved", "Legal"]]},
		pluck="name",
	)

	for case_name in open_cases:
		case = frappe.get_doc("Debtor Case", case_name)
		case.refresh_ageing()

		stage = _reminder_stage(case.days_overdue, first_days, second_days, escalation_days)
		stage_advanced = _REMINDER_STAGE_ORDER.index(stage) > _REMINDER_STAGE_ORDER.index(case.last_reminder_stage or "None")

		newly_escalated = stage == "Escalation" and case.workflow_state not in ("Escalated", "Legal")
		if newly_escalated:
			case.workflow_state = "Escalated"
		if stage_advanced:
			case.last_reminder_stage = stage

		case.save(ignore_permissions=True)

		if stage_advanced and stage in ("First", "Second"):
			from edupro_school_fees.notifications import notify_debtor_reminder

			notify_debtor_reminder(case, stage, first_template if stage == "First" else second_template)

		if newly_escalated:
			from edupro_school_fees.notifications import notify_debt_escalation

			notify_debt_escalation(case)


def check_payment_plan_installments():
	"""Daily scheduler job: flips a Pending installment past its due_date to
	Overdue, and marks its Payment Plan Defaulted once any installment on it is
	overdue. The plan's own Debtor Case is left to run_debtor_ageing_escalation()'s
	normal ageing/escalation logic, not duplicated here."""
	overdue_installments = frappe.get_all(
		"Payment Plan Installment",
		filters={"status": "Pending", "due_date": ["<", frappe.utils.nowdate()]},
		fields=["name", "parent"],
	)

	affected_plans = set()
	for row in overdue_installments:
		frappe.db.set_value("Payment Plan Installment", row.name, "status", "Overdue")
		affected_plans.add(row.parent)

	for plan_name in affected_plans:
		plan = frappe.get_doc("Payment Plan", plan_name)
		if plan.status == "Active" and any(row.status == "Overdue" for row in plan.installments):
			plan.status = "Defaulted"
			plan.save(ignore_permissions=True)


DEFAULT_REQUIRED_QUOTES = 3
DEFAULT_SENSITIVE_PROCUREMENT_THRESHOLD = 5000.0


def _school_setup_name():
	return frappe.db.get_value("School Setup", {}, "name")


def get_required_quote_count(amount):
	"""How many competitive quotations a Requisition of this total estimated
	amount needs before a Purchase Order can be issued against it -- the
	School Setup singleton's own procurement_quote_bands, banded by amount
	(the highest band whose min_amount the requisition meets or exceeds
	applies). Falls back to the PRAZ baseline of 3 if no School Setup exists
	yet, or its band table is empty -- unconfigured behaves exactly like the
	hardcoded rule this replaces, rather than silently requiring 0 quotes."""
	setup_name = _school_setup_name()
	if not setup_name:
		return DEFAULT_REQUIRED_QUOTES

	bands = frappe.get_all(
		"Procurement Quote Band",
		filters={"parenttype": "School Setup", "parent": setup_name},
		fields=["min_amount", "required_quotes"],
		order_by="min_amount asc",
	)
	if not bands:
		return DEFAULT_REQUIRED_QUOTES

	applicable = [b for b in bands if flt(amount) >= flt(b.min_amount)]
	if not applicable:
		return DEFAULT_REQUIRED_QUOTES
	return max(applicable, key=lambda b: flt(b.min_amount)).required_quotes


def get_sensitive_procurement_threshold():
	"""The Purchase Order amount at or above which its Payment Voucher needs a
	District Education Auditor/Inspector co-signature before final School
	Head approval -- configurable via School Setup, defaulting to 5000 if
	unset (see co_sign_sensitive_procurement in payment_voucher.py)."""
	setup_name = _school_setup_name()
	if not setup_name:
		return DEFAULT_SENSITIVE_PROCUREMENT_THRESHOLD
	threshold = frappe.db.get_value("School Setup", setup_name, "sensitive_procurement_threshold")
	return flt(threshold) if threshold else DEFAULT_SENSITIVE_PROCUREMENT_THRESHOLD


DEFAULT_FIRST_REMINDER_DAYS = 7
DEFAULT_SECOND_REMINDER_DAYS = 30
DEFAULT_ESCALATION_DAYS = 90


def get_debtor_reminder_settings():
	"""(first_days, second_days, escalation_days, first_template, second_template)
	for the graduated debtor reminder cadence -- configurable via School Setup's
	Debtor Management section, falling back to the historical hardcoded values
	(7/30/90, no template) if unset. See run_debtor_ageing_escalation()."""
	setup_name = _school_setup_name()
	if not setup_name:
		return DEFAULT_FIRST_REMINDER_DAYS, DEFAULT_SECOND_REMINDER_DAYS, DEFAULT_ESCALATION_DAYS, None, None

	row = frappe.db.get_value(
		"School Setup", setup_name,
		["first_reminder_days", "second_reminder_days", "escalation_days", "first_reminder_template", "second_reminder_template"],
		as_dict=True,
	)
	return (
		cint(row.first_reminder_days) or DEFAULT_FIRST_REMINDER_DAYS,
		cint(row.second_reminder_days) or DEFAULT_SECOND_REMINDER_DAYS,
		cint(row.escalation_days) or DEFAULT_ESCALATION_DAYS,
		row.first_reminder_template,
		row.second_reminder_template,
	)
