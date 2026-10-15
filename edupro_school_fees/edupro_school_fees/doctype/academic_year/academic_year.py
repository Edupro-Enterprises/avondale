# Copyright (c) 2025, Edupro and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from dateutil.relativedelta import relativedelta


class AcademicYear(Document):
	def before_save(self):
		"""Validate dates and ensure only one current Academic Year."""
		# Validate end_date is after start_date. Date fields can arrive as either
		# `str` or `datetime.date` depending on the code path that constructed this
		# document (a known Frappe inconsistency) -- normalize with getdate() first.
		if self.start_date and self.end_date:
			if frappe.utils.getdate(self.start_date) > frappe.utils.getdate(self.end_date):
				frappe.throw("End Date must be after Start Date")

		# Ensure only one current Academic Year
		if self.is_current:
			frappe.db.sql("""
				UPDATE `tabAcademic Year` 
				SET is_current = 0 
				WHERE name != %s AND is_current = 1
			""", self.name)

	def on_trash(self):
		"""Prevent deletion if Terms exist."""
		terms_count = frappe.db.count("Term", {"academic_year": self.name})
		if terms_count > 0:
			frappe.throw(f"Cannot delete Academic Year '{self.name}' as it has {terms_count} associated Term(s).")

	def after_insert(self):
		"""Auto-generate 3 terms when Academic Year is created."""
		# Check if terms already exist
		existing_terms = frappe.get_all("Term", filters={"academic_year": self.name}, pluck="name")
		if existing_terms:
			return

		# Calculate term dates
		start_date = frappe.utils.getdate(self.start_date)
		end_date = frappe.utils.getdate(self.end_date)
		
		total_days = (end_date - start_date).days
		term_duration = total_days // 3
		
		for i in range(1, 4):
			term_start = start_date + relativedelta(days=(i - 1) * term_duration)
			if i == 3:
				term_end = end_date
			else:
				term_end = start_date + relativedelta(days=i * term_duration - 1)
			
			term_type_map = {1: "Term1", 2: "Term2", 3: "Term3"}
			
			term = frappe.get_doc({
				"doctype": "Term",
				"term_name": f"{self.academic_year_name} - Term {i}",
				"academic_year": self.name,
				"term_number": i,
				"start_date": term_start,
				"end_date": term_end,
				"term_type": term_type_map.get(i, "Term1"),
				"is_active": 0,
				"is_current": 0
			})
			term.insert(ignore_permissions=True)
		
		frappe.msgprint(f"Generated 3 terms for {self.academic_year_name}", alert=True)
