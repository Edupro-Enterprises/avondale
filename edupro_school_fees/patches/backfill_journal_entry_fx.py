# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Phase 3 added Journal Entry Account.exchange_rate. Every account in this app's
	Chart of Accounts predating Phase 3 is ZiG (the base currency) -- see
	school_setup.py's generate_chart_of_accounts(), whose only non-ZiG leaf
	("Bank - FCA") had no Payment Method wired to it yet, per the Phase 2.0 forensics
	check. So every pre-existing row can be safely backfilled to 1 with no judgment
	call needed."""
	frappe.db.sql(
		"""
		UPDATE `tabJournal Entry Account`
		SET exchange_rate = 1
		WHERE exchange_rate IS NULL
		"""
	)
