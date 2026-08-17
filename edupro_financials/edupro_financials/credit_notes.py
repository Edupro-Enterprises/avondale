"""Credit Notes / Reverse Receipt Entries (spec: Transactional Vouchers).

Zero-deletion means the only way to void a receipt is to cancel it -
Frappe already reverses the GL Entries automatically on cancel. What was
missing is an *audit trail for why* - this hook makes that mandatory
before the cancellation is allowed to proceed, and the reason then renders
on the "Credit Note" print format alongside the reversed receipt.
"""

import frappe
from frappe import _


def require_cancellation_reason(doc, method):
	if doc.get("is_opening_balance"):
		# Migrated legacy balances are cancelled/corrected in bulk during
		# data migration review, not through the day-to-day receipt flow -
		# don't force a per-record reason for those.
		return
	if not doc.get("cancellation_reason"):
		frappe.throw(
			_(
				"A cancellation reason is required before this receipt can be reversed. "
				"Set the 'Cancellation / Credit Note Reason' field first, then cancel."
			)
		)
