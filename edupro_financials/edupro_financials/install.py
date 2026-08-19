import frappe

FUND_CATEGORIES = [
	("SDC / SDA Fund", "SDC / SDA"),
	("Tuition / General Government Fund", "Tuition / Government"),
	("BEAM & Donor Restricted Fund", "BEAM & Donor Restricted"),
	("Income-Generating Projects (IGP) Fund", "IGP"),
]

ROLES = [
	"Headmaster",
	"Bursar",
	"SDC Chairperson",
	"Deputy Head",
]

FUND_CATEGORY_OPTIONS = "SDC / SDA\nTuition / Government\nBEAM & Donor Restricted\nIGP"


def after_install():
	create_roles()
	create_zig_currency()
	create_funds()
	create_fund_accounting_dimension()
	create_vote_book_custom_fields()
	create_receipt_custom_fields()
	create_fees_fund_field()
	create_fee_structure_income_account_field()
	create_migration_custom_fields()
	create_student_profile_fields()
	create_portal_role_permissions()
	create_voucher_custom_fields()
	configure_print_settings()
	create_procurement_item()
	create_procurement_custom_fields()
	grant_bursar_procurement_permissions()
	create_igp_accounts()
	create_igp_items()
	create_walk_in_customer()
	create_sales_invoice_custom_fields()
	grant_bursar_igp_permissions()
	grant_bursar_exemption_permissions()
	create_receipting_accounts_and_modes()
	create_payment_entry_custom_fields()
	grant_bursar_payment_permissions()
	frappe.db.commit()


def create_roles():
	# School-side roles (Headmaster, Bursar, SDC Chairperson, Deputy Head)
	# never use the Frappe Desk - they work entirely through the branded
	# portal, which talks to the backend over the REST API. desk_access=0
	# means Frappe itself refuses them entry to /app, independent of
	# whatever the portal's own routing does.
	for role_name in ROLES:
		if not frappe.db.exists("Role", role_name):
			frappe.get_doc(
				{"doctype": "Role", "role_name": role_name, "desk_access": 0}
			).insert(ignore_permissions=True)
		else:
			frappe.db.set_value("Role", role_name, "desk_access", 0)


def create_zig_currency():
	if not frappe.db.exists("Currency", "ZiG"):
		frappe.get_doc(
			{
				"doctype": "Currency",
				"currency_name": "ZiG",
				"fraction": "Cent",
				"fraction_units": 100,
				"symbol": "ZiG",
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
	else:
		frappe.db.set_value("Currency", "ZiG", "enabled", 1)


def create_funds():
	for fund_name, fund_category in FUND_CATEGORIES:
		if not frappe.db.exists("Fund", fund_name):
			frappe.get_doc(
				{
					"doctype": "Fund",
					"fund_name": fund_name,
					"fund_category": fund_category,
				}
			).insert(ignore_permissions=True)


def create_fund_accounting_dimension():
	if frappe.db.exists("Accounting Dimension", {"document_type": "Fund"}):
		return
	if not frappe.db.exists("DocType", "Accounting Dimension"):
		# ERPNext not installed yet - accounting dimensions require it.
		return

	frappe.get_doc(
		{
			"doctype": "Accounting Dimension",
			"document_type": "Fund",
			"label": "Fund",
		}
	).insert(ignore_permissions=True)


def create_vote_book_custom_fields():
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Purchase Order": [
				{
					"fieldname": "funding_category",
					"label": "Funding Category",
					"fieldtype": "Select",
					"options": FUND_CATEGORY_OPTIONS,
					"insert_after": "cost_center",
					"reqd": 0,
				},
				{
					"fieldname": "fiscal_year",
					"label": "Fiscal Year",
					"fieldtype": "Link",
					"options": "Fiscal Year",
					"insert_after": "funding_category",
					"fetch_from": "",
				},
			]
		},
		ignore_validate=True,
	)


def create_receipt_custom_fields():
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Fees": [
				{
					"fieldname": "receipt_no",
					"label": "Receipt No",
					"fieldtype": "Data",
					"read_only": 1,
					"in_list_view": 1,
					"in_standard_filter": 1,
					"insert_after": "grand_total",
					"allow_on_submit": 1,
				},
				{
					"fieldname": "terminal",
					"label": "Terminal",
					"fieldtype": "Data",
					"default": "HAR",
					"insert_after": "receipt_no",
					"description": "Terminal/branch code used in the receipt number sequence, e.g. HAR for Harare.",
				},
			]
		},
		ignore_validate=True,
	)


def create_migration_custom_fields():
	"""Support fields for importing legacy Pastel balances: a reconciliation
	key back to the source system, and a flag that excludes migrated opening
	balances from the sequential receipt-numbering series - no physical
	receipt was ever issued for carried-forward debt, so giving it a
	REC-... number would falsely imply one was, and would be flagged by the
	Auditor Exception Dashboard's own gap detector.
	"""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Student": [
				{
					"fieldname": "pastel_account_code",
					"label": "Pastel Account Code",
					"fieldtype": "Data",
					"read_only": 1,
					"in_list_view": 1,
					"in_standard_filter": 1,
					"insert_after": "title",
					"description": "External reference to the student's account code in the legacy Pastel system, preserved for migration reconciliation.",
				},
			],
			"Fees": [
				{
					"fieldname": "is_opening_balance",
					"label": "Is Migrated Opening Balance",
					"fieldtype": "Check",
					"insert_after": "terminal",
					"description": "Set for arrears carried forward from a legacy system during data migration. Excluded from sequential receipt numbering since no physical receipt was issued.",
				},
			],
		},
		ignore_validate=True,
	)


def create_student_profile_fields():
	"""The Education app's Student doctype already covers photo, DOB,
	address, and parent/guardian details (via the Guardian doctype) - these
	four fields are what's genuinely missing for the portal's Student
	Profile page: quick-reference health/emergency info and free-text
	sports/academic notes. Deliberately plain Small Text, not a structured
	child table - the spec only calls for "for now, N/A + editable", not a
	full records system."""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Student": [
				{
					"fieldname": "health_tab",
					"label": "Health & Activities",
					"fieldtype": "Tab Break",
					"insert_after": "connections_tab",
				},
				{
					"fieldname": "emergency_contact_name",
					"label": "Emergency Contact Name",
					"fieldtype": "Data",
					"insert_after": "health_tab",
				},
				{
					"fieldname": "emergency_contact_phone",
					"label": "Emergency Contact Phone",
					"fieldtype": "Data",
					"insert_after": "emergency_contact_name",
				},
				{
					"fieldname": "column_break_health",
					"fieldtype": "Column Break",
					"insert_after": "emergency_contact_phone",
				},
				{
					"fieldname": "allergies",
					"label": "Allergies",
					"fieldtype": "Small Text",
					"insert_after": "column_break_health",
				},
				{
					"fieldname": "medical_conditions",
					"label": "Medical Conditions",
					"fieldtype": "Small Text",
					"insert_after": "allergies",
				},
				{
					"fieldname": "sports_and_clubs",
					"label": "Sports & Clubs",
					"fieldtype": "Small Text",
					"insert_after": "medical_conditions",
				},
				{
					"fieldname": "academic_notes",
					"label": "Academic Notes",
					"fieldtype": "Small Text",
					"insert_after": "sports_and_clubs",
				},
			],
		},
		ignore_validate=True,
	)


def create_fees_fund_field():
	"""The Fund Accounting Dimension auto-installs on Fee Structure and Fee
	Schedule (both are in ERPNext's dimension-enabled doctype list) but NOT
	on Fees itself, since the Education app never registered Fees there.
	Without this, every GL Entry Fees posts has no fund - it lands in the
	statutory reports' "(Unassigned)" bucket instead of the correct fund.
	Add it manually, fetched from the Fee Structure, so GL postings inherit
	the fund like they do for receivable_account/income_account/cost_center.
	"""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Fees": [
				{
					"fieldname": "fund",
					"label": "Fund",
					"fieldtype": "Link",
					"options": "Fund",
					"fetch_from": "fee_structure.fund",
					"insert_after": "cost_center",
				},
			]
		},
		ignore_validate=True,
	)


def create_fee_structure_income_account_field():
	"""Fees.income_account (a stock Education-app field) has
	fetch_from="fee_structure.income_account" - but this build of the
	Education app (version-15.2) never actually put that field on Fee
	Structure. Left unfixed, *every* Fees insert fails outright: link
	validation SELECTs income_account from `tabFee Structure` and MariaDB
	throws "Unknown column" since the column doesn't exist. Add it as a
	custom field so the fetch_from has something real to read.
	"""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Fee Structure": [
				{
					"fieldname": "income_account",
					"label": "Income Account",
					"fieldtype": "Link",
					"options": "Account",
					"insert_after": "receivable_account",
				},
			]
		},
		ignore_validate=True,
	)


# Doctypes the read-only portal dashboards (auditor exceptions, oversight
# ledger/summary) query. Without explicit read permission here, frappe.get_all
# doesn't error for these Website Users - it silently returns an empty list,
# which is worse than an error: an auditor would see "no exceptions found"
# for a reason that has nothing to do with there being no exceptions.
OVERSIGHT_READ_DOCTYPES = [
	"GL Entry",
	"Fees",
	"Journal Entry",
	"Purchase Order",
	"Payment Entry",
	"Sales Invoice",
	"Vote Book Allocation",
	"Daily Cashier Reconciliation",
	"Fund",
	"MoPSE Fee Approval",
	"Student",
	"Student Exemption and Discount",
	"Fee Schedule",
	"Fee Structure",
]

# All four roles read the statutory reports (MoPSE statements, vote-book
# variance, fee arrears aging) on their respective portal pages - Bursar
# included, since "read the numbers" and "operate the till" are different
# permissions even though Bursar already has full CRUD on the till itself.
OVERSIGHT_ROLES = ["Headmaster", "SDC Chairperson", "Deputy Head", "Bursar"]


def create_portal_role_permissions():
	from frappe.permissions import add_permission, update_permission_property

	def grant(doctype, role, ptypes):
		# add_permission only creates a Custom DocPerm row and no-ops if one
		# already exists for this doctype+role+permlevel - it does NOT layer
		# additional ptypes onto an existing row. So: create the row with the
		# first ptype, then explicitly flip on every other ptype via
		# update_permission_property against that same row.
		first, rest = ptypes[0], ptypes[1:]
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
			add_permission(doctype, role, permlevel=0, ptype=first)
		else:
			update_permission_property(doctype, role, 0, first, 1)
		for ptype in rest:
			update_permission_property(doctype, role, 0, ptype, 1)

	# Bursar operates the till end-to-end: create, edit while draft, submit.
	grant("Daily Cashier Reconciliation", "Bursar", ["read", "write", "create", "submit"])

	# Headmaster / SDC Chairperson / Deputy Head are read-only across the
	# doctypes the oversight and auditor exception dashboards query.
	for role in OVERSIGHT_ROLES:
		for doctype in OVERSIGHT_READ_DOCTYPES:
			grant(doctype, role, ["read"])


def create_voucher_custom_fields():
	"""Fields backing the printable vouchers: a mandatory reason captured on
	every Fees cancellation (the Credit Note voucher renders this - spec's
	"Credit Notes / Reverse Receipt Entries"), and the payment compliance
	checklist spec section 5.3 requires above $100 USD."""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Fees": [
				{
					"fieldname": "cancellation_reason",
					"label": "Cancellation / Credit Note Reason",
					"fieldtype": "Small Text",
					"insert_after": "is_opening_balance",
					"allow_on_submit": 1,
					"description": "Required before this receipt can be cancelled - renders on the Credit Note voucher.",
				},
			],
			"Payment Entry": [
				{
					"fieldname": "comparative_schedule_attached",
					"label": "Comparative Schedule Attached",
					"fieldtype": "Check",
					"insert_after": "reference_no",
				},
				{
					"fieldname": "quotations_attached",
					"label": "3 Supplier Quotations Attached",
					"fieldtype": "Check",
					"insert_after": "comparative_schedule_attached",
				},
				{
					"fieldname": "finance_committee_minutes_ref",
					"label": "Finance Committee Minutes Ref",
					"fieldtype": "Data",
					"insert_after": "quotations_attached",
				},
			],
		},
		ignore_validate=True,
	)


def configure_print_settings():
	"""Frappe blocks printing any cancelled/submittable document by default
	(Print Settings.allow_print_for_cancelled=0) - but the "Credit Note"
	voucher exists specifically to print a cancelled Fees record as proof of
	a reversed receipt, so that default has to be flipped on for this site."""
	frappe.db.set_single_value("Print Settings", "allow_print_for_cancelled", 1)


PROCUREMENT_ITEM_CODE = "General Procurement Item"


def create_procurement_item():
	"""One generic non-stock/service Item backs every requisition line - the
	school procures a huge variety of one-off goods and services, and
	forcing a full Item-master SKU catalog on the Bursar for a Purchase
	Requisition drafting form would be pure friction. The actual line
	description is overridden per-transaction (standard ERPNext behaviour),
	so this code never appears on the printed voucher - only the typed
	description does."""
	if frappe.db.exists("Item", PROCUREMENT_ITEM_CODE):
		return

	item_group = frappe.db.get_value("Item Group", {}, "name") or "All Item Groups"
	frappe.get_doc(
		{
			"doctype": "Item",
			"item_code": PROCUREMENT_ITEM_CODE,
			"item_name": PROCUREMENT_ITEM_CODE,
			"item_group": item_group,
			"is_stock_item": 0,
			"stock_uom": "Nos",
			"uoms": [{"uom": "Nos", "conversion_factor": 1}],
			"include_item_in_manufacturing": 0,
			"is_purchase_item": 1,
		}
	).insert(ignore_permissions=True, ignore_mandatory=True)


def create_procurement_custom_fields():
	"""Mirrors the Payment Voucher's compliance checklist, but at the
	requisition stage (spec: "Procurement File Attachments" - 3 competitive
	quotations, a comparative schedule, and a supplier proforma invoice must
	exist before a Purchase Requisition is ready for approval)."""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Purchase Order": [
				{
					"fieldname": "quotations_attached",
					"label": "3 Competitive Vendor Quotations Attached",
					"fieldtype": "Check",
					"insert_after": "fiscal_year",
				},
				{
					"fieldname": "comparative_schedule_attached",
					"label": "Comparative Schedule Attached",
					"fieldtype": "Check",
					"insert_after": "quotations_attached",
				},
				{
					"fieldname": "proforma_invoice_attached",
					"label": "Supplier Proforma Invoice Attached",
					"fieldtype": "Check",
					"insert_after": "comparative_schedule_attached",
				},
			],
		},
		ignore_validate=True,
	)


def grant_bursar_procurement_permissions():
	"""Bursar drafts and submits requisitions end-to-end from the portal -
	same "operate it fully, from a portal form, never touching Desk"
	pattern already used for the till (Daily Cashier Reconciliation)."""
	from frappe.permissions import add_permission, update_permission_property

	def grant(doctype, role, ptypes):
		first, rest = ptypes[0], ptypes[1:]
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
			add_permission(doctype, role, permlevel=0, ptype=first)
		else:
			update_permission_property(doctype, role, 0, first, 1)
		for ptype in rest:
			update_permission_property(doctype, role, 0, ptype, 1)

	grant("Purchase Order", "Bursar", ["read", "write", "create", "submit"])
	grant("Supplier", "Bursar", ["read", "write", "create"])
	grant("Vote Book Allocation", "Bursar", ["read"])
	# ERPNext's get_item_details() (called from Purchase Order's own
	# validate(), to auto-fill item defaults) does its own explicit
	# check_permission() against the Item doctype regardless of the parent
	# document's ignore_permissions flag - so drafting a requisition fails
	# with a bare PermissionError unless the Bursar can also read Item.
	grant("Item", "Bursar", ["read"])


# label -> (account_name, item_code) - one dedicated income account per
# enterprise activity so each keeps its own trading account (spec: "Project
# Fund Mapping...preserve individual project trading accounts"), while every
# sale is also tagged with the shared IGP Fund dimension for fund-level
# rollup. Two levels of granularity, not a contradiction: the Fund answers
# "how much IGP money is there in total", the account answers "how much of
# that came from the tuckshop specifically".
IGP_PROJECTS = [
	("Tuckshop Sales", "Tuckshop Sales - APS", "Tuckshop Sale"),
	("Uniform Shop Sales", "Uniform Shop Sales - APS", "Uniform Shop Sale"),
	("Bus Hire Income", "Bus Hire Income - APS", "Bus Hire Receipt"),
	("Agricultural Produce Sales", "Agricultural Produce Sales - APS", "Agricultural Produce Sale"),
]

IGP_ACCOUNT_GROUP = "Income-Generating Projects - APS"


def create_igp_accounts():
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	if not company:
		return

	if not frappe.db.exists("Account", IGP_ACCOUNT_GROUP):
		frappe.get_doc(
			{
				"doctype": "Account",
				"account_name": "Income-Generating Projects",
				"parent_account": "Direct Income - APS",
				"company": company,
				"is_group": 1,
				"root_type": "Income",
			}
		).insert(ignore_permissions=True)

	for label, account_name, _item_code in IGP_PROJECTS:
		if frappe.db.exists("Account", account_name):
			continue
		frappe.get_doc(
			{
				"doctype": "Account",
				"account_name": label,
				"parent_account": IGP_ACCOUNT_GROUP,
				"company": company,
				"is_group": 0,
				"root_type": "Income",
			}
		).insert(ignore_permissions=True)


def create_igp_items():
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	item_group = frappe.db.get_value("Item Group", {}, "name") or "All Item Groups"

	for _label, account_name, item_code in IGP_PROJECTS:
		if frappe.db.exists("Item", item_code):
			continue
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": item_code,
				"item_name": item_code,
				"item_group": item_group,
				"is_stock_item": 0,
				"stock_uom": "Nos",
				"uoms": [{"uom": "Nos", "conversion_factor": 1}],
				"is_sales_item": 1,
				"include_item_in_manufacturing": 0,
				"item_defaults": [{"company": company, "income_account": account_name}],
			}
		).insert(ignore_permissions=True, ignore_mandatory=True)


WALK_IN_CUSTOMER = "Walk-In / Enterprise Sales"


def create_walk_in_customer():
	if frappe.db.exists("Customer", WALK_IN_CUSTOMER):
		return
	customer_group = frappe.db.get_value("Customer Group", {}, "name") or "All Customer Groups"
	territory = frappe.db.get_value("Territory", {}, "name") or "All Territories"
	frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": WALK_IN_CUSTOMER,
			"customer_group": customer_group,
			"territory": territory,
			"customer_type": "Individual",
		}
	).insert(ignore_permissions=True, ignore_mandatory=True)


def create_sales_invoice_custom_fields():
	"""Same receipt_no/terminal pair Fees carries, so enterprise counter
	sales feed the identical sequential-receipt-numbering and gap-detection
	machinery (receipts.py, Auditor Exception Dashboard) instead of a
	second parallel one."""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Sales Invoice": [
				{
					"fieldname": "receipt_no",
					"label": "Receipt No",
					"fieldtype": "Data",
					"read_only": 1,
					"in_list_view": 1,
					"in_standard_filter": 1,
					"insert_after": "grand_total",
					"allow_on_submit": 1,
				},
				{
					"fieldname": "terminal",
					"label": "Terminal",
					"fieldtype": "Data",
					"default": "HAR",
					"insert_after": "receipt_no",
				},
			]
		},
		ignore_validate=True,
	)


def grant_bursar_igp_permissions():
	from frappe.permissions import add_permission, update_permission_property

	def grant(doctype, role, ptypes):
		first, rest = ptypes[0], ptypes[1:]
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
			add_permission(doctype, role, permlevel=0, ptype=first)
		else:
			update_permission_property(doctype, role, 0, first, 1)
		for ptype in rest:
			update_permission_property(doctype, role, 0, ptype, 1)

	grant("Sales Invoice", "Bursar", ["read", "write", "create", "submit"])
	grant("Customer", "Bursar", ["read", "write", "create"])
	# ERPNext's get_party_account() (resolving the receivable account for a
	# new Sales Invoice) does its own explicit account_perm_check() against
	# the Account doctype, same story as the Item check in procurement -
	# ignore_permissions=True on the parent Sales Invoice doesn't cover it.
	grant("Account", "Bursar", ["read"])


def grant_bursar_exemption_permissions():
	from frappe.permissions import add_permission, update_permission_property

	def grant(doctype, role, ptypes):
		first, rest = ptypes[0], ptypes[1:]
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
			add_permission(doctype, role, permlevel=0, ptype=first)
		else:
			update_permission_property(doctype, role, 0, first, 1)
		for ptype in rest:
			update_permission_property(doctype, role, 0, ptype, 1)

	grant("Student Exemption and Discount", "Bursar", ["read", "write", "create", "submit"])


def create_receipting_accounts_and_modes():
	"""Counter receipting needs somewhere to post each tender type. Only one
	postable cash account existed before this (Cash - APS, USD) - Bank
	Accounts and Cash In Hand were both left as empty group accounts by the
	standard Chart of Accounts template, and no ZiG-denominated account
	existed at all (which also meant revaluation.py's ZiG revaluation could
	never find anything to revalue)."""
	company = frappe.db.get_single_value("Global Defaults", "default_company")

	if not frappe.db.exists("Account", "Bank - APS"):
		frappe.get_doc(
			{
				"doctype": "Account",
				"account_name": "Bank",
				"parent_account": "Bank Accounts - APS",
				"company": company,
				"is_group": 0,
				"root_type": "Asset",
				"account_type": "Bank",
				"account_currency": "USD",
			}
		).insert(ignore_permissions=True)

	if not frappe.db.exists("Account", "Cash ZiG - APS"):
		frappe.get_doc(
			{
				"doctype": "Account",
				"account_name": "Cash ZiG",
				"parent_account": "Cash In Hand - APS",
				"company": company,
				"is_group": 0,
				"root_type": "Asset",
				"account_type": "Cash",
				"account_currency": "ZiG",
			}
		).insert(ignore_permissions=True)

	# (mode name, default account, existing-mode-to-configure-if-already-present)
	modes = [
		("Cash (ZiG)", "Cash ZiG - APS"),
		("EcoCash", "Bank - APS"),
		("ZIPIT", "Bank - APS"),
		("POS Swipe", "Bank - APS"),
	]
	for mode_name, account in modes:
		if not frappe.db.exists("Mode of Payment", mode_name):
			frappe.get_doc(
				{
					"doctype": "Mode of Payment",
					"mode_of_payment": mode_name,
					"type": "General",
					"accounts": [{"company": company, "default_account": account}],
				}
			).insert(ignore_permissions=True)

	# Bank Transfer reuses the stock "Wire Transfer" mode rather than adding
	# a near-duplicate - just give it a default account, since none of the
	# stock modes had one configured.
	if frappe.db.exists("Mode of Payment", "Wire Transfer"):
		wire = frappe.get_doc("Mode of Payment", "Wire Transfer")
		if not any(a.company == company for a in wire.accounts):
			wire.append("accounts", {"company": company, "default_account": "Bank - APS"})
			wire.save(ignore_permissions=True)


def create_payment_entry_custom_fields():
	"""Same receipt_no/terminal pair Fees and Sales Invoice carry - see
	receipts.py:assign_receipt_number_to_payment. Payment Entry is where
	receipt numbering actually belongs for the bill-now-pay-later flow: a
	Fees record's own on_submit fires at *billing* time, when nothing has
	been paid yet (outstanding always equals grand_total then), so that
	hook can never meaningfully fire for a payment collected later.
	"""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(
		{
			"Payment Entry": [
				{
					"fieldname": "receipt_no",
					"label": "Receipt No",
					"fieldtype": "Data",
					"read_only": 1,
					"in_list_view": 1,
					"in_standard_filter": 1,
					"insert_after": "reference_no",
					"allow_on_submit": 1,
				},
				{
					"fieldname": "terminal",
					"label": "Terminal",
					"fieldtype": "Data",
					"default": "HAR",
					"insert_after": "receipt_no",
				},
				{
					"fieldname": "cancellation_reason",
					"label": "Cancellation / Credit Note Reason",
					"fieldtype": "Small Text",
					"insert_after": "terminal",
					"description": "Required before this payment receipt can be cancelled - see credit_notes.py.",
				},
			]
		},
		ignore_validate=True,
	)


def grant_bursar_payment_permissions():
	from frappe.permissions import add_permission, update_permission_property

	def grant(doctype, role, ptypes):
		first, rest = ptypes[0], ptypes[1:]
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
			add_permission(doctype, role, permlevel=0, ptype=first)
		else:
			update_permission_property(doctype, role, 0, first, 1)
		for ptype in rest:
			update_permission_property(doctype, role, 0, ptype, 1)

	grant("Payment Entry", "Bursar", ["read", "write", "create", "submit", "cancel"])
	grant("Currency Exchange", "Bursar", ["read", "write", "create"])
