"""Vote-Book pre-commitment control.

Wired via hooks.py doc_events on Purchase Order:
	validate  -> validate_vote_book_budget   (blocks overrun before submission)
	on_submit -> commit_vote_book_amount     (locks the commitment in)
	on_cancel -> release_vote_book_amount    (reverses the commitment)

Material Request / Purchase Requisition can be wired the same way once a
custom `expense_account` field is added to its item table — ERPNext's
standard Material Request Item does not carry one.
"""

import frappe
from frappe import _
from frappe.utils import flt


def validate_vote_book_budget(doc, method):
	for item in doc.items:
		if not item.expense_account:
			continue

		budget = frappe.db.get_value(
			"Vote Book Allocation",
			{
				"expense_account": item.expense_account,
				"fund_category": doc.funding_category,
				"fiscal_year": doc.fiscal_year,
			},
			["name", "approved_budget", "committed_amount", "actual_spent"],
			as_dict=True,
		)

		if not budget:
			frappe.throw(
				_("Row #{0}: No approved Vote-Book budget found for account {1} under {2}").format(
					item.idx, item.expense_account, doc.funding_category
				)
			)

		available = flt(budget.approved_budget) - (
			flt(budget.committed_amount) + flt(budget.actual_spent)
		)

		if flt(item.amount) > available:
			frappe.throw(
				_(
					"VOTE-BOOK OVERRUN EXCEPTION: Requested amount {0} exceeds available "
					"balance {1} for line item {2}."
				).format(
					frappe.format_value(item.amount, {"fieldtype": "Currency"}),
					frappe.format_value(available, {"fieldtype": "Currency"}),
					item.expense_account,
				)
			)


def commit_vote_book_amount(doc, method):
	_adjust_committed_amount(doc, sign=1)


def release_vote_book_amount(doc, method):
	_adjust_committed_amount(doc, sign=-1)


def _adjust_committed_amount(doc, sign):
	for item in doc.items:
		if not item.expense_account:
			continue

		allocation_name = frappe.db.get_value(
			"Vote Book Allocation",
			{
				"expense_account": item.expense_account,
				"fund_category": doc.funding_category,
				"fiscal_year": doc.fiscal_year,
			},
			"name",
		)
		if not allocation_name:
			continue

		allocation = frappe.get_doc("Vote Book Allocation", allocation_name)
		allocation.committed_amount = flt(allocation.committed_amount) + sign * flt(item.amount)
		allocation.save(ignore_permissions=True)
