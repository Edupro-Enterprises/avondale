# Copyright (c) 2025, Edupro and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Term(Document):
	def before_save(self):
		"""Validate term dates fall within academic year and ensure only one current term."""
		# Date fields can arrive as either `str` or `datetime.date` depending on the
		# code path that constructed this document (a known Frappe inconsistency) --
		# normalize with getdate() before comparing, or "2026-01-01" < date(...) raises
		# TypeError instead of behaving like a real date comparison.
		start_date = frappe.utils.getdate(self.start_date)
		end_date = frappe.utils.getdate(self.end_date)

		if start_date and end_date and start_date > end_date:
			frappe.throw("End Date must be after Start Date")

		# Validate term dates fall within academic year dates
		if self.academic_year:
			academic_year = frappe.get_doc("Academic Year", self.academic_year)
			ay_start = frappe.utils.getdate(academic_year.start_date)
			ay_end = frappe.utils.getdate(academic_year.end_date)
			if start_date < ay_start or end_date > ay_end:
				frappe.throw(f"Term dates must fall within Academic Year '{academic_year.academic_year_name}' dates ({ay_start} to {ay_end})")

		# Ensure only one current Term
		if self.is_current:
			frappe.db.sql("""
				UPDATE `tabTerm` 
				SET is_current = 0 
				WHERE name != %s AND is_current = 1
			""", self.name)

		# Validate sequential order if other terms exist
		self._validate_term_sequence()

	def _validate_term_sequence(self):
		"""Validate that terms are in sequential order (1, 2, 3)."""
		if not self.academic_year or not self.term_number:
			return

		existing_terms = frappe.get_all(
			"Term",
			filters={"academic_year": self.academic_year, "name": ["!=", self.name]},
			fields=["term_number"]
		)

		for existing in existing_terms:
			if existing.term_number == self.term_number:
				frappe.throw(f"Term {self.term_number} already exists for this Academic Year")

	def on_trash(self):
		"""Allow deletion but warn if it breaks sequence."""
		pass
