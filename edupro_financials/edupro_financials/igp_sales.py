"""Income-Generating Projects (IGP) Counter Sales - direct cash receipting
for enterprise activities (tuckshop, uniform shop, bus hire, agricultural
produce). Each sale is a POS-mode Sales Invoice, submitted immediately since
this is genuinely cash-in-hand at the point of sale (unlike Fees term
billing, there's no "invoiced but unpaid" state here) - so it gets a real
sequential receipt number right away via the same receipts.py hook Fees
uses.
"""

import frappe
from frappe import _
from frappe.utils import flt, nowdate

from edupro_financials.install import IGP_PROJECTS, WALK_IN_CUSTOMER

IGP_FUND = "Income-Generating Projects (IGP) Fund"


@frappe.whitelist()
def get_form_options():
	return {
		"projects": [{"label": label, "item_code": item_code} for label, _acct, item_code in IGP_PROJECTS],
		"modes_of_payment": frappe.get_all("Mode of Payment", fields=["name"], order_by="name"),
		"company": frappe.db.get_single_value("Global Defaults", "default_company"),
	}


@frappe.whitelist()
def create_sale(item_code, description, amount, mode_of_payment, terminal="HAR"):
	frappe.only_for("Bursar")
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Amount must be greater than zero."))

	valid_items = {item_code for _label, _acct, item_code in IGP_PROJECTS}
	if item_code not in valid_items:
		frappe.throw(_("Unknown project item: {0}").format(item_code))

	company = frappe.db.get_single_value("Global Defaults", "default_company")

	si = frappe.get_doc(
		{
			"doctype": "Sales Invoice",
			"customer": WALK_IN_CUSTOMER,
			"company": company,
			"posting_date": nowdate(),
			"is_pos": 1,
			"fund": IGP_FUND,
			"terminal": terminal,
			"items": [
				{
					"item_code": item_code,
					"item_name": description or item_code,
					"description": description or item_code,
					"qty": 1,
					"rate": amount,
				}
			],
			"payments": [
				{
					"mode_of_payment": mode_of_payment,
					"amount": amount,
				}
			],
		}
	)
	si.insert(ignore_permissions=True)
	si.submit()
	frappe.db.commit()
	return si.name


@frappe.whitelist()
def list_sales(limit=100):
	rows = frappe.get_all(
		"Sales Invoice",
		filters={"fund": IGP_FUND, "docstatus": 1},
		fields=["name", "posting_date", "receipt_no", "grand_total", "owner"],
		order_by="posting_date desc, creation desc",
		limit_page_length=int(limit),
	)
	for row in rows:
		item = frappe.db.get_value(
			"Sales Invoice Item", {"parent": row.name}, ["item_code", "description"], as_dict=True
		)
		row["item_code"] = item.item_code if item else None
		row["description"] = item.description if item else None
	return rows


@frappe.whitelist()
def get_project_totals():
	"""Per-project trading account totals - this is the "preserve
	individual project trading accounts" requirement made visible: each
	project's own income account, summed independently, not just the IGP
	fund lumped together."""
	rows = []
	for label, account_name, item_code in IGP_PROJECTS:
		total = frappe.db.sql(
			"""
			select coalesce(sum(gle.credit - gle.debit), 0)
			from `tabGL Entry` gle
			where gle.account = %(account)s and gle.is_cancelled = 0
			""",
			{"account": account_name},
		)[0][0]
		rows.append({"label": label, "account": account_name, "item_code": item_code, "total": flt(total)})
	return rows
