import frappe
from frappe.utils import flt, nowdate


@frappe.whitelist()
def get_till_context():
	user = frappe.session.user
	today = nowdate()
	existing = frappe.db.exists(
		"Daily Cashier Reconciliation", {"cashier_user": user, "reconciliation_date": today}
	)
	return {
		"cashier_user": user,
		"reconciliation_date": today,
		"already_closed": bool(existing),
		"existing_name": existing,
	}


@frappe.whitelist()
def close_till(
	opening_float=0,
	usd_cash_counted=0,
	zig_cash_counted=0,
	ecocash_batch_total=0,
	zipit_batch_total=0,
	bursar_signature=None,
):
	doc = frappe.get_doc(
		{
			"doctype": "Daily Cashier Reconciliation",
			"cashier_user": frappe.session.user,
			"reconciliation_date": nowdate(),
			"opening_float": flt(opening_float),
			"usd_cash_counted": flt(usd_cash_counted),
			"zig_cash_counted": flt(zig_cash_counted),
			"ecocash_batch_total": flt(ecocash_batch_total),
			"zipit_batch_total": flt(zipit_batch_total),
			"bursar_signature": bursar_signature,
		}
	)
	doc.insert()
	doc.submit()

	return {
		"name": doc.name,
		"system_expected_usd": doc.system_expected_usd,
		"variance_usd": doc.variance_usd,
	}
