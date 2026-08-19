"""Daily exchange rate lock (spec: "Automated Exchange Rate Lock").

The rate isn't fetched live - the Bursar enters the MoPSE-approved/interbank
rate once each morning, and every multi-currency transaction posted that day
(receipting, revaluation) automatically uses whatever's on record for that
date via ERPNext's standard Currency Exchange lookup. "Locked" means once
set for a date it's authoritative for that date, not that it's read-only -
setting it again the same day just updates the same record.
"""

import frappe
from frappe import _
from frappe.utils import flt, nowdate


@frappe.whitelist()
def set_daily_rate(rate, rate_date=None):
	frappe.only_for("Bursar")

	rate = flt(rate)
	if rate <= 0:
		frappe.throw(_("Exchange rate must be a positive number."))

	rate_date = rate_date or nowdate()

	_upsert(rate_date, "ZiG", "USD", rate)
	_upsert(rate_date, "USD", "ZiG", 1 / rate)

	frappe.db.commit()
	return get_rate_for_date(rate_date)


def _upsert(rate_date, from_currency, to_currency, rate):
	existing = frappe.db.exists(
		"Currency Exchange", {"date": rate_date, "from_currency": from_currency, "to_currency": to_currency}
	)
	if existing:
		frappe.db.set_value("Currency Exchange", existing, "exchange_rate", rate)
		return existing

	doc = frappe.get_doc(
		{
			"doctype": "Currency Exchange",
			"date": rate_date,
			"from_currency": from_currency,
			"to_currency": to_currency,
			"exchange_rate": rate,
			"for_buying": 1,
			"for_selling": 1,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


@frappe.whitelist()
def get_today_rate():
	return get_rate_for_date(nowdate())


def get_rate_for_date(rate_date):
	rate = frappe.db.get_value(
		"Currency Exchange", {"date": rate_date, "from_currency": "ZiG", "to_currency": "USD"}, "exchange_rate"
	)
	return {"date": rate_date, "zig_to_usd": flt(rate) if rate else None, "is_set": bool(rate)}
