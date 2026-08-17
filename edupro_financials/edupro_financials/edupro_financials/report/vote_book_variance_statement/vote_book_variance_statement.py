import frappe
from frappe import _
from frappe.utils import flt


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": _("Fund Category"), "fieldname": "fund_category", "fieldtype": "Data", "width": 200},
		{"label": _("Expense Account"), "fieldname": "expense_account", "fieldtype": "Link", "options": "Account", "width": 220},
		{"label": _("Fiscal Year"), "fieldname": "fiscal_year", "fieldtype": "Link", "options": "Fiscal Year", "width": 100},
		{"label": _("Approved Budget"), "fieldname": "approved_budget", "fieldtype": "Currency", "width": 130},
		{"label": _("Committed Amount"), "fieldname": "committed_amount", "fieldtype": "Currency", "width": 140},
		{"label": _("Actual Spent"), "fieldname": "actual_spent", "fieldtype": "Currency", "width": 120},
		{"label": _("Total Utilized"), "fieldname": "total_utilized", "fieldtype": "Currency", "width": 130},
		{"label": _("Available Balance"), "fieldname": "available_balance", "fieldtype": "Currency", "width": 140},
		{"label": _("% Utilized"), "fieldname": "percent_utilized", "fieldtype": "Percent", "width": 100},
	]


def get_data(filters):
	conditions = {}
	if filters.get("fiscal_year"):
		conditions["fiscal_year"] = filters["fiscal_year"]
	if filters.get("fund_category"):
		conditions["fund_category"] = filters["fund_category"]

	rows = frappe.get_all(
		"Vote Book Allocation",
		filters=conditions,
		fields=[
			"fund_category",
			"expense_account",
			"fiscal_year",
			"approved_budget",
			"committed_amount",
			"actual_spent",
			"available_balance",
		],
		order_by="fund_category, expense_account",
	)

	data = []
	for row in rows:
		total_utilized = flt(row.committed_amount) + flt(row.actual_spent)
		percent_utilized = (total_utilized / flt(row.approved_budget) * 100) if row.approved_budget else 0
		data.append(
			{
				"fund_category": row.fund_category,
				"expense_account": row.expense_account,
				"fiscal_year": row.fiscal_year,
				"approved_budget": row.approved_budget,
				"committed_amount": row.committed_amount,
				"actual_spent": row.actual_spent,
				"total_utilized": total_utilized,
				"available_balance": row.available_balance,
				"percent_utilized": percent_utilized,
			}
		)
	return data
