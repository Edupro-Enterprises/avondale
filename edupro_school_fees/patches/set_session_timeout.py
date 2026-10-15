# Copyright (c) 2026, Edupro and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""DEF-033/NFR-23: session idle timeout must be 30 minutes -- Frappe's own
	default (System Settings.session_expiry) is "170:00" (170 hours, effectively
	no real timeout for a financial system). No app code path enforces this,
	so it was purely a matter of production configuration nobody had set.
	"""
	frappe.db.set_single_value("System Settings", "session_expiry", "0:30:00")
