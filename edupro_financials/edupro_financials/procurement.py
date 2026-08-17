"""Expenditure Requisitions (Vote-Book Drafting) - lets the Bursar draft a
Purchase Requisition entirely from the portal: pick an expense account and
fund category per line, see the live unspent Vote-Book balance for that
combination before committing to anything, attach the mandatory procurement
files, then save as a draft ready for the physical sign-off workflow the
Purchase Order Voucher print format already supports.
"""

import json

import frappe
from frappe import _
from frappe.utils import flt

from edupro_financials.install import PROCUREMENT_ITEM_CODE

# Select-value (matches Purchase Order.funding_category / Vote Book
# Allocation.fund_category) -> Fund Link value, so a requisition also
# populates the Accounting Dimension "fund" field GL Entries actually key
# off, not just the budget-check Select field.
FUND_CATEGORY_TO_FUND = {
	"SDC / SDA": "SDC / SDA Fund",
	"Tuition / Government": "Tuition / General Government Fund",
	"BEAM & Donor Restricted": "BEAM & Donor Restricted Fund",
	"IGP": "Income-Generating Projects (IGP) Fund",
}


@frappe.whitelist()
def get_form_options():
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	return {
		"expense_accounts": frappe.get_all(
			"Account",
			filters={"company": company, "root_type": "Expense", "is_group": 0},
			fields=["name"],
			order_by="name",
		),
		"fund_categories": list(FUND_CATEGORY_TO_FUND.keys()),
		"suppliers": frappe.get_all("Supplier", fields=["name", "supplier_name"], order_by="supplier_name"),
		"fiscal_years": frappe.get_all("Fiscal Year", fields=["name"], order_by="year_start_date desc"),
		"default_fiscal_year": frappe.db.get_value("Fiscal Year", {}, "name", order_by="year_start_date desc"),
		"company": company,
	}


@frappe.whitelist()
def create_supplier(supplier_name):
	supplier_name = (supplier_name or "").strip()
	if not supplier_name:
		frappe.throw(_("Supplier name is required."))
	if frappe.db.exists("Supplier", supplier_name):
		return supplier_name

	supplier_group = frappe.db.get_value("Supplier Group", {}, "name") or "All Supplier Groups"
	doc = frappe.get_doc(
		{
			"doctype": "Supplier",
			"supplier_name": supplier_name,
			"supplier_group": supplier_group,
			"supplier_type": "Company",
		}
	)
	doc.insert(ignore_permissions=True, ignore_mandatory=True)
	return doc.name


@frappe.whitelist()
def get_vote_book_balance(expense_account, fund_category, fiscal_year):
	"""The number the Bursar needs before typing an amount in: what's still
	unspent on this exact expense-account/fund/year line, matching the same
	lookup vote_book.py's validate_vote_book_budget hook will run at save
	time - so this preview can never say "fits" when the save would then
	reject it, or vice versa."""
	if not (expense_account and fund_category and fiscal_year):
		return None

	budget = frappe.db.get_value(
		"Vote Book Allocation",
		{"expense_account": expense_account, "fund_category": fund_category, "fiscal_year": fiscal_year},
		["name", "approved_budget", "committed_amount", "actual_spent"],
		as_dict=True,
	)
	if not budget:
		return {
			"found": False,
			"approved_budget": 0,
			"committed_amount": 0,
			"actual_spent": 0,
			"available_balance": 0,
		}

	available = flt(budget.approved_budget) - (flt(budget.committed_amount) + flt(budget.actual_spent))
	return {
		"found": True,
		"allocation_name": budget.name,
		"approved_budget": flt(budget.approved_budget),
		"committed_amount": flt(budget.committed_amount),
		"actual_spent": flt(budget.actual_spent),
		"available_balance": available,
	}


@frappe.whitelist()
def create_requisition(supplier, fiscal_year, schedule_date, items):
	"""Saves a DRAFT Purchase Order (docstatus 0) - not submitted. The
	vote_book.py `validate` hook still runs on every save though, so a line
	that would overrun its Vote-Book balance is rejected right here, at
	drafting time, not silently allowed through until someone tries to
	submit it later."""
	if isinstance(items, str):
		items = json.loads(items)
	if not items:
		frappe.throw(_("At least one requisition line is required."))

	company = frappe.db.get_single_value("Global Defaults", "default_company")
	doc_items = []
	for row in items:
		fund_category = row.get("funding_category")
		doc_items.append(
			{
				"item_code": PROCUREMENT_ITEM_CODE,
				"item_name": row.get("description") or PROCUREMENT_ITEM_CODE,
				"description": row.get("description") or PROCUREMENT_ITEM_CODE,
				"qty": flt(row.get("qty") or 1),
				"rate": flt(row.get("rate")),
				"expense_account": row.get("expense_account"),
				"schedule_date": schedule_date,
			}
		)

	# All lines share one funding_category/fund on this doctype (header-
	# level field) - use the first line's, since a single requisition is
	# realistically one procurement need against one budget line.
	funding_category = items[0].get("funding_category")

	po = frappe.get_doc(
		{
			"doctype": "Purchase Order",
			"supplier": supplier,
			"company": company,
			"transaction_date": frappe.utils.nowdate(),
			"schedule_date": schedule_date,
			"funding_category": funding_category,
			"fund": FUND_CATEGORY_TO_FUND.get(funding_category),
			"fiscal_year": fiscal_year,
			"items": doc_items,
		}
	)
	po.insert(ignore_permissions=True)
	frappe.db.commit()
	return po.name


@frappe.whitelist()
def attach_procurement_files(purchase_order, quotations_attached=None, comparative_schedule_attached=None, proforma_invoice_attached=None):
	"""Flip the compliance checkboxes once the corresponding file(s) have
	actually been uploaded (see api.uploadProcurementFile on the frontend,
	which calls Frappe's own /api/method/upload_file against this same
	document first)."""
	doc = frappe.get_doc("Purchase Order", purchase_order)
	if doc.docstatus == 2:
		frappe.throw(_("Cannot attach files to a cancelled requisition."))

	updates = {}
	if quotations_attached is not None:
		updates["quotations_attached"] = 1 if int(quotations_attached) else 0
	if comparative_schedule_attached is not None:
		updates["comparative_schedule_attached"] = 1 if int(comparative_schedule_attached) else 0
	if proforma_invoice_attached is not None:
		updates["proforma_invoice_attached"] = 1 if int(proforma_invoice_attached) else 0

	for fieldname, value in updates.items():
		frappe.db.set_value("Purchase Order", purchase_order, fieldname, value, update_modified=False)
	frappe.db.commit()
	return updates


@frappe.whitelist()
def submit_requisition(purchase_order):
	doc = frappe.get_doc("Purchase Order", purchase_order)
	doc.submit()
	frappe.db.commit()
	return doc.name


@frappe.whitelist()
def list_requisitions(limit=100):
	rows = frappe.get_all(
		"Purchase Order",
		fields=[
			"name", "supplier", "transaction_date", "schedule_date", "funding_category",
			"fiscal_year", "grand_total", "docstatus", "status",
			"quotations_attached", "comparative_schedule_attached", "proforma_invoice_attached",
		],
		order_by="creation desc",
		limit_page_length=int(limit),
	)
	for row in rows:
		row["attachment_count"] = frappe.db.count(
			"File", {"attached_to_doctype": "Purchase Order", "attached_to_name": row.name}
		)
	return rows


@frappe.whitelist()
def get_requisition_detail(purchase_order):
	doc = frappe.get_doc("Purchase Order", purchase_order)
	files = frappe.get_all(
		"File",
		filters={"attached_to_doctype": "Purchase Order", "attached_to_name": purchase_order},
		fields=["file_name", "file_url", "creation"],
	)
	balance_by_line = []
	for item in doc.items:
		balance_by_line.append(
			{
				"description": item.description,
				"expense_account": item.expense_account,
				"amount": flt(item.amount),
				"balance": get_vote_book_balance(item.expense_account, doc.funding_category, doc.fiscal_year),
			}
		)
	return {
		"name": doc.name,
		"supplier": doc.supplier,
		"docstatus": doc.docstatus,
		"funding_category": doc.funding_category,
		"fiscal_year": doc.fiscal_year,
		"grand_total": flt(doc.grand_total),
		"quotations_attached": doc.quotations_attached,
		"comparative_schedule_attached": doc.comparative_schedule_attached,
		"proforma_invoice_attached": doc.proforma_invoice_attached,
		"items": balance_by_line,
		"files": files,
	}
