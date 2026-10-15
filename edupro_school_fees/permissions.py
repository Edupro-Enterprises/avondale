"""Portal RBAC (Phase 5.1): row-level scoping for the two self-service roles,
Parent/Guardian and Student. Both layers are needed -- a permission_query_conditions
hook only filters *list* queries; without a matching has_permission hook, a portal
user who already knows (or guesses) another family's document name could still
frappe.get_doc() it directly. Internal roles (Bursar, School Head, etc.) are
untouched by any of this: every function below defers to Frappe's ordinary
DocPerm-based evaluation for anyone who isn't Parent/Guardian or Student, by
returning "" (no extra restriction) from a query-condition hook or True (no
extra restriction -- ANDed with the normal DocPerm-based result) from a
has_permission hook.

INCIDENT (2026-09-23): every has_*_permission function below used to return
None for "doesn't apply, defer to DocPerm" -- the documented Frappe
convention for years. A framework version bump pulled the same day (see the
edupro-school-fees-financial-statement-system commits from that date; not an
app-code regression) changed core's combination logic to treat a hook
returning None as an outright denial instead of an abstain, which silently
broke every internal role's ability to create/write ANY of these doctypes
(confirmed live: Bursar could not create a Receipt, Invoice, Fee Structure,
Payment Plan, or Student). Returning True keeps the exact same intent (defer
to DocPerm) under the new semantics.
"""

import frappe

PORTAL_ROLES = ("Parent/Guardian", "Student")


def _is_portal_user(roles):
	return any(role in roles for role in PORTAL_ROLES) and "System Manager" not in roles


def _linked_parent_guardian(user):
	return frappe.db.get_value("Parent Guardian", {"user": user}, "name")


def _linked_student(user):
	return frappe.db.get_value("Student", {"user": user}, "name")


def _guardian_student_names(parent_guardian):
	# DEF-027: a guardian linked only via secondary_guardian (Student has two
	# guardian Links: primary "guardian" and "secondary_guardian") used to be
	# matched against "guardian" alone -- not a cross-family leak, but a real
	# denial of legitimate portal access to their own child.
	primary = frappe.get_all("Student", filters={"guardian": parent_guardian}, pluck="name")
	secondary = frappe.get_all("Student", filters={"secondary_guardian": parent_guardian}, pluck="name")
	return list(set(primary) | set(secondary))


def _own_student_names(user):
	"""Every Student name this user is allowed to see: their own record (if
	they're a Student) and/or their children's (if they're a Parent/Guardian)."""
	names = set()

	parent_guardian = _linked_parent_guardian(user)
	if parent_guardian:
		names.update(_guardian_student_names(parent_guardian))

	student = _linked_student(user)
	if student:
		names.add(student)

	return names


# --- Student -----------------------------------------------------------------


def student_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	names = _own_student_names(user)
	if not names:
		return "1=0"

	names_sql = ", ".join(frappe.db.escape(name) for name in names)
	return f"`tabStudent`.name in ({names_sql})"


def has_student_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.name in _own_student_names(user)


# --- Invoice -------------------------------------------------------------------


def invoice_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	names = _own_student_names(user)
	if not names:
		return "1=0"

	names_sql = ", ".join(frappe.db.escape(name) for name in names)
	return f"`tabInvoice`.student in ({names_sql})"


def has_invoice_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.student in _own_student_names(user)


# --- Receipt (Parent/Guardian only -- Student is never granted DocPerm read
# here, so this hook only ever runs for a Parent/Guardian user in practice,
# but the role check is kept explicit rather than assumed). ------------------


def receipt_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	names = _own_student_names(user)
	if not names:
		return "1=0"

	names_sql = ", ".join(frappe.db.escape(name) for name in names)
	return f"`tabReceipt`.student in ({names_sql})"


def has_receipt_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.student in _own_student_names(user)


# --- Credit Note (same student-scoping as Invoice/Receipt) -------------------


def credit_note_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	names = _own_student_names(user)
	if not names:
		return "1=0"

	names_sql = ", ".join(frappe.db.escape(name) for name in names)
	return f"`tabCredit Note`.student in ({names_sql})"


def has_credit_note_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.student in _own_student_names(user)


# --- Payment Plan -- Parent/Guardian and Student, scoped to the same
# _own_student_names() used by Invoice/Receipt/Credit Note above (a Student
# has always been included in that helper; DocPerm just never granted them
# read access to this doctype, found live testing the real /student/
# payment-plan page against production -- a real Student account got a
# console 403 on their own payment plan). ------------------------------------


def payment_plan_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	names = _own_student_names(user)
	if not names:
		return "1=0"

	names_sql = ", ".join(frappe.db.escape(name) for name in names)
	return f"`tabPayment Plan`.student in ({names_sql})"


def has_payment_plan_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.student in _own_student_names(user)


# --- Fee Structure -- transparency document, not family-scoped: any Approved
# structure is visible to every portal user, matching the spec's AGM-style
# "parents can see what's being charged" intent. Draft/Pending/Rejected stay
# invisible regardless of whose child it would apply to. ----------------------


def fee_structure_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	return "`tabFee Structure`.workflow_state = 'Approved'"


def has_fee_structure_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.workflow_state == "Approved"


# --- Parent Guardian -- a portal user may only ever see their own record
# (Parent/Guardian) or the guardian(s) linked to their own Student record
# (Student -- Student.guardian / Student.secondary_guardian, mirroring
# DEF-027's both-fields check). A Student previously had no DocPerm read
# access to this doctype at all -- found live testing /student/settings
# against production, a real Student account got a console 403 just
# showing their own guardian's contact details. ------------------------------


def _guardian_names_for_student(student_name):
	if not student_name:
		return set()
	guardian, secondary_guardian = frappe.db.get_value(
		"Student", student_name, ["guardian", "secondary_guardian"]
	) or (None, None)
	return {name for name in (guardian, secondary_guardian) if name}


def _own_parent_guardian_names(user):
	names = set()

	parent_guardian = _linked_parent_guardian(user)
	if parent_guardian:
		names.add(parent_guardian)

	names.update(_guardian_names_for_student(_linked_student(user)))

	return names


def parent_guardian_permission_query(user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return ""

	names = _own_parent_guardian_names(user)
	if not names:
		return "1=0"

	names_sql = ", ".join(frappe.db.escape(name) for name in names)
	return f"`tabParent Guardian`.name in ({names_sql})"


def has_parent_guardian_permission(doc, user=None, permission_type=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if not _is_portal_user(roles):
		return True

	return doc.name in _own_parent_guardian_names(user)


# --- Phase 6a: SDC Chairperson/Treasurer is fund-scoped to Fund B (SDC/SDA)
# only, on the three procurement doctypes -- spec: "No access to Fund A
# (Government Tuition/Grants/Salary subsidies)". Flagged as a known gap in
# ADR 0005 when Phase 5.1 only had Fee Structure/GL read access to reason
# about; closed here now that SDC gets real procurement co-approval duties.
# A different concern from the portal-role scoping above (this restricts an
# *internal* role, not a family), so kept as its own small section rather
# than folded into _is_portal_user's logic. ---------------------------------

FUND_B = "Fund B - SDC/SDA"


def _sdc_fund_scope(user, doctype):
	roles = frappe.get_roles(user)
	if "SDC Chairperson/Treasurer" not in roles or "System Manager" in roles:
		return ""
	return f"`tab{doctype}`.fund = {frappe.db.escape(FUND_B)}"


def _sdc_fund_has_permission(doc, user):
	roles = frappe.get_roles(user)
	if "SDC Chairperson/Treasurer" not in roles or "System Manager" in roles:
		return True
	return doc.fund == FUND_B


def requisition_permission_query(user=None):
	return _sdc_fund_scope(user or frappe.session.user, "Requisition")


def has_requisition_permission(doc, user=None, permission_type=None):
	return _sdc_fund_has_permission(doc, user or frappe.session.user)


def purchase_order_permission_query(user=None):
	return _sdc_fund_scope(user or frappe.session.user, "Purchase Order")


def has_purchase_order_permission(doc, user=None, permission_type=None):
	return _sdc_fund_has_permission(doc, user or frappe.session.user)


def payment_voucher_permission_query(user=None):
	return _sdc_fund_scope(user or frappe.session.user, "Payment Voucher")


def has_payment_voucher_permission(doc, user=None, permission_type=None):
	return _sdc_fund_has_permission(doc, user or frappe.session.user)


# --- Phase 6b: same SDC fund-scoping, extended to Budget Line and Cashbook Payment --
# both carry their own `fund` field (Budget Line directly; Cashbook Payment copies it
# from the Payment Voucher at validate() time), so the existing _sdc_fund_scope/
# _sdc_fund_has_permission helpers apply unchanged. Budget Vote Book itself is left
# unscoped -- it has no `fund` column (one book covers both funds' lines), and SDC's
# "monitors vote-book spending lines" duty is read-only at the Budget Line level
# regardless. -------------------------------------------------------------------


def budget_line_permission_query(user=None):
	return _sdc_fund_scope(user or frappe.session.user, "Budget Line")


def has_budget_line_permission(doc, user=None, permission_type=None):
	return _sdc_fund_has_permission(doc, user or frappe.session.user)


def cashbook_payment_permission_query(user=None):
	return _sdc_fund_scope(user or frappe.session.user, "Cashbook Payment")


def has_cashbook_payment_permission(doc, user=None, permission_type=None):
	return _sdc_fund_has_permission(doc, user or frappe.session.user)


# --- Journal Entry -- SDC's read DocPerm previously gave them the raw GL
# unscoped, letting them read Fund A (tuition/government) entries through the
# ledger even though every doctype that *produces* those entries is already
# fund-scoped against them. Journal Entry now carries its own `fund` (set in
# utils._reference_fund()); an entry whose fund can't be determined
# unambiguously (e.g. a Petty Cash Replenishment spanning both funds) is left
# unset and is therefore invisible to SDC too -- the safe default, never an
# accidental Fund A leak. ------------------------------------------------


def journal_entry_permission_query(user=None):
	return _sdc_fund_scope(user or frappe.session.user, "Journal Entry")


def has_journal_entry_permission(doc, user=None, permission_type=None):
	return _sdc_fund_has_permission(doc, user or frappe.session.user)
